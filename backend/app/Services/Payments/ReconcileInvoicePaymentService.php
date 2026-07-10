<?php

namespace App\Services\Payments;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\NaiTalkOverpaymentCredited;
use App\Notifications\NaiTalkPaymentReceived;
use App\Notifications\NaiTalkUnderpaymentReceived;
use App\Notifications\NaiTalkWalletPaymentConfirmation;
use App\Services\Billing\VatCalculator;
use App\Services\Notifications\ClientNotifier;
use App\Services\Provisioning\IspConfigProvisioningService;
use App\Services\Wallet\WalletService;
use Illuminate\Support\Facades\DB;

/**
 * The single reconciliation choke point for every payment channel — online
 * gateway settlement, bank transfer admin approval, wallet payments, and
 * auto-renewal charges all call reconcile() instead of implementing their
 * own paid/overpaid/underpaid handling. This is what keeps provisioning
 * eligibility, wallet crediting, and notifications consistent everywhere.
 */
class ReconcileInvoicePaymentService
{
    public function __construct(
        private readonly VatCalculator $vatCalculator,
        private readonly WalletService $wallet,
        private readonly IspConfigProvisioningService $provisioning,
        private readonly ClientNotifier $notifier,
    ) {
    }

    /**
     * @param  array{actor?: ?User, gateway_payload?: array, description?: string, source?: string, skip_notification?: bool}  $context
     */
    public function reconcile(Invoice $invoice, Payment $payment, int $amountKobo, string $method, array $context = []): Invoice
    {
        $outcome = DB::transaction(function () use ($invoice, $payment, $amountKobo, $method, $context) {
            $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();

            // Idempotency: the same payment reference can arrive twice (webhook
            // + browser callback, or a retried webhook) — only reconcile once.
            if ($payment->reconciled_at !== null) {
                return ['invoice' => $invoice->fresh(), 'outcome' => 'already_reconciled'];
            }

            $invoice = Invoice::query()->whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            $expected = $this->vatCalculator->calculate((int) $invoice->subtotal_kobo, (int) $invoice->discount_kobo, (float) $invoice->vat_rate);

            if ($expected['vat_amount_kobo'] !== (int) $invoice->tax_kobo || $expected['total_kobo'] !== (int) $invoice->total_kobo) {
                // Must NOT abort() here — that throws inside the transaction and
                // would roll back the 'mismatch' flag we're trying to persist.
                // Flag it, commit, and abort once the transaction has closed.
                $invoice->forceFill(['reconciliation_status' => 'mismatch'])->save();

                $this->logAudit($invoice, $payment, $method, 'mismatch', $context, [
                    'expected_vat_amount_kobo' => $expected['vat_amount_kobo'],
                    'expected_total_kobo' => $expected['total_kobo'],
                    'stored_vat_amount_kobo' => $invoice->tax_kobo,
                    'stored_total_kobo' => $invoice->total_kobo,
                ]);

                return ['invoice' => $invoice, 'outcome' => 'mismatch'];
            }

            $before = $invoice->only([
                'status', 'reconciliation_status', 'amount_paid_kobo', 'overpayment_amount_kobo',
                'underpayment_amount_kobo', 'outstanding_amount_kobo', 'wallet_amount_applied_kobo',
            ]);

            $payment->forceFill([
                'status' => 'paid',
                'amount_kobo' => $amountKobo,
                'paid_at' => now(),
                'reconciled_at' => now(),
                'gateway_payload' => $context['gateway_payload'] ?? $payment->gateway_payload,
            ])->save();

            $walletAppliedKobo = (int) $invoice->wallet_amount_applied_kobo + ($method === 'wallet' ? $amountKobo : 0);
            $newAmountPaid = (int) $invoice->amount_paid_kobo + $amountKobo;
            $totalKobo = (int) $invoice->total_kobo;

            if ($newAmountPaid === $totalKobo) {
                $outcome = 'exact';
                $invoice->forceFill([
                    'status' => 'paid',
                    'reconciliation_status' => 'reconciled',
                    'amount_paid_kobo' => $newAmountPaid,
                    'wallet_amount_applied_kobo' => $walletAppliedKobo,
                    'overpayment_amount_kobo' => 0,
                    'underpayment_amount_kobo' => 0,
                    'outstanding_amount_kobo' => 0,
                    'paid_at' => now()->toDateString(),
                ])->save();
            } elseif ($newAmountPaid > $totalKobo) {
                $outcome = 'overpayment';
                $overpaymentKobo = $newAmountPaid - $totalKobo;

                $invoice->forceFill([
                    'status' => 'paid',
                    'reconciliation_status' => 'reconciled',
                    'amount_paid_kobo' => $totalKobo,
                    'wallet_amount_applied_kobo' => $walletAppliedKobo,
                    'overpayment_amount_kobo' => $overpaymentKobo,
                    'underpayment_amount_kobo' => 0,
                    'outstanding_amount_kobo' => 0,
                    'paid_at' => now()->toDateString(),
                ])->save();

                $this->wallet->credit($invoice->client, $overpaymentKobo, 'overpayment_credit', [
                    'invoice_id' => $invoice->id,
                    'order_id' => $invoice->order_id,
                    'payment_reference' => $payment->reference,
                    'description' => "Overpayment credit from invoice {$invoice->invoice_number}",
                ]);
            } else {
                $outcome = 'underpayment';
                $underpaymentKobo = $totalKobo - $newAmountPaid;

                $invoice->forceFill([
                    'status' => 'partially_paid',
                    'reconciliation_status' => 'pending',
                    'amount_paid_kobo' => $newAmountPaid,
                    'wallet_amount_applied_kobo' => $walletAppliedKobo,
                    'underpayment_amount_kobo' => $underpaymentKobo,
                    'outstanding_amount_kobo' => $underpaymentKobo,
                ])->save();

                // Money taken from the client's own wallet to pay down this
                // invoice must never be credited back to that same wallet —
                // that would let the client re-spend it indefinitely.
                if ($method !== 'wallet') {
                    $this->wallet->credit($invoice->client, $amountKobo, 'underpayment_credit', [
                        'invoice_id' => $invoice->id,
                        'order_id' => $invoice->order_id,
                        'payment_reference' => $payment->reference,
                        'description' => "Underpayment credit from invoice {$invoice->invoice_number}",
                    ]);
                }
            }

            $servicesToProvision = collect();

            if ($invoice->status === 'paid' && $invoice->order_id) {
                $invoice->order?->forceFill(['status' => 'completed'])->save();
                $servicesToProvision = $invoice->order->hostingServices()->get();

                foreach ($servicesToProvision as $service) {
                    $service->forceFill([
                        'status' => 'awaiting_provisioning',
                        'provisioning_status' => 'awaiting_provisioning',
                    ])->save();
                }
            }

            $this->logAudit($invoice, $payment, $method, $outcome, $context, [
                'before' => $before,
                'after' => $invoice->only([
                    'status', 'reconciliation_status', 'amount_paid_kobo', 'overpayment_amount_kobo',
                    'underpayment_amount_kobo', 'outstanding_amount_kobo', 'wallet_amount_applied_kobo',
                ]),
            ]);

            return ['invoice' => $invoice, 'outcome' => $outcome, 'services' => $servicesToProvision, 'payment' => $payment];
        });

        if ($outcome['outcome'] === 'already_reconciled') {
            return $outcome['invoice'];
        }

        if ($outcome['outcome'] === 'mismatch') {
            abort(422, 'This invoice failed a VAT integrity check and cannot be reconciled. Please contact support.');
        }

        /** @var Invoice $invoice */
        $invoice = $outcome['invoice'];

        foreach ($outcome['services'] ?? [] as $service) {
            $this->provisioning->queueProvisioning($service);
        }

        if (! ($context['skip_notification'] ?? false)) {
            $this->notify($invoice, $outcome['outcome'], $method, $amountKobo);
        }

        return $invoice;
    }

    private function notify(Invoice $invoice, string $outcome, string $method, int $amountKobo): void
    {
        $client = $invoice->client;

        if (! $client) {
            return;
        }

        // Money the client just moved out of their own wallet gets its own
        // "wallet payment successful" email, whether or not it fully closes
        // the invoice — "your payment has been saved in your wallet" (the
        // underpayment wording) would be nonsensical for wallet-sourced funds.
        if ($method === 'wallet') {
            $this->notifier->notify(
                $client,
                new NaiTalkWalletPaymentConfirmation($invoice, $amountKobo),
                'wallet_payment_confirmation',
                "Wallet payment applied to invoice {$invoice->invoice_number}",
                $invoice->hostingService
            );

            return;
        }

        [$notification, $template, $subject] = match ($outcome) {
            'exact' => [new NaiTalkPaymentReceived($invoice), 'payment_received', "Payment received for invoice {$invoice->invoice_number}"],
            'overpayment' => [new NaiTalkOverpaymentCredited($invoice), 'overpayment_credited', 'Payment received — extra balance saved to your wallet'],
            'underpayment' => [new NaiTalkUnderpaymentReceived($invoice), 'underpayment_received', "Partial payment received for invoice {$invoice->invoice_number}"],
            default => [null, null, null],
        };

        if (! $notification) {
            return;
        }

        $this->notifier->notify($client, $notification, $template, $subject, $invoice->hostingService);
    }

    /**
     * @param  array{actor?: ?User, gateway_payload?: array, description?: string, source?: string}  $context
     * @param  array<string, mixed>  $extra
     */
    private function logAudit(Invoice $invoice, Payment $payment, string $method, string $outcome, array $context, array $extra = []): void
    {
        $actor = $context['actor'] ?? null;

        AuditLog::query()->create([
            'staff_user_id' => $actor?->id,
            'client_id' => $invoice->client_id,
            'invoice_id' => $invoice->id,
            'action' => 'payment_reconciled',
            'reason' => "Payment reconciliation outcome: {$outcome} via {$method}.",
            'before_state' => $extra['before'] ?? null,
            'after_state' => $extra['after'] ?? null,
            'notify_client' => false,
            'source' => $context['source'] ?? ($actor ? 'admin' : 'system'),
            'supporting_reference' => $payment->reference,
            'error_details' => $outcome === 'mismatch' ? json_encode($extra) : null,
        ]);
    }
}
