<?php

namespace App\Jobs;

use App\Exceptions\InsufficientWalletBalanceException;
use App\Exceptions\PaymentGatewayException;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\SavedPaymentMethod;
use App\Models\User;
use App\Notifications\ClientNotificationFailed;
use App\Notifications\NaiTalkAutoRenewalFailed;
use App\Notifications\NaiTalkAutoRenewalSuccess;
use App\Notifications\NaiTalkRenewalPaymentReminder;
use App\Services\Notifications\ClientNotifier;
use App\Services\Payments\ChargeSavedCardService;
use App\Services\Payments\ReconcileInvoicePaymentService;
use App\Services\Payments\SavedPaymentMethodService;
use App\Services\Wallet\WalletService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Illuminate\Support\Str;
use Throwable;

/**
 * Daily sweep that attempts payment on outstanding standard-service renewal
 * invoices, in the priority order from spec §10: wallet first, then a
 * wallet+card split, then a full card charge, then (no card available) a
 * reminder email. Every attempt — success or failure — goes through
 * ReconcileInvoicePaymentService so provisioning/notification/audit
 * behaviour is identical to any other payment channel.
 */
class ProcessAutoRenewalPaymentJob implements ShouldQueue
{
    use Queueable;

    public function handle(
        WalletService $walletService,
        SavedPaymentMethodService $savedMethods,
        ChargeSavedCardService $chargeService,
        ReconcileInvoicePaymentService $reconciler,
        ClientNotifier $notifier,
    ): void {
        Invoice::query()
            ->whereNull('order_id')
            ->whereIn('status', ['unpaid', 'partially_paid'])
            ->whereHas('hostingService', fn ($query) => $query->where('auto_renew_enabled', true)->where('plan_type', '!=', 'legacy'))
            ->with(['hostingService.client.user'])
            ->get()
            ->each(fn (Invoice $invoice) => $this->attempt($invoice, $walletService, $savedMethods, $chargeService, $reconciler, $notifier));
    }

    private function attempt(
        Invoice $invoice,
        WalletService $walletService,
        SavedPaymentMethodService $savedMethods,
        ChargeSavedCardService $chargeService,
        ReconcileInvoicePaymentService $reconciler,
        ClientNotifier $notifier,
    ): void {
        $service = $invoice->hostingService;
        $client = $service?->client;

        if (! $service || ! $client) {
            return;
        }

        $invoice = $invoice->fresh();

        if ($invoice->status === 'paid') {
            return;
        }

        $outstandingKobo = $invoice->outstanding_amount_kobo ?: max($invoice->total_kobo - $invoice->amount_paid_kobo, 0);

        if ($outstandingKobo <= 0) {
            return;
        }

        $wallet = $walletService->walletFor($client);
        $walletBalanceKobo = $wallet->balance_kobo;
        $card = $savedMethods->defaultAutoRenewalMethod($client);
        $email = $client->user?->email ?: $client->billing_email;

        try {
            if ($walletBalanceKobo >= $outstandingKobo) {
                $this->payFromWallet($invoice, $outstandingKobo, $client, $walletService, $reconciler);
                $this->onSuccess($service, $invoice->fresh(), 'wallet', $notifier);

                return;
            }

            if ($walletBalanceKobo > 0 && $card) {
                $this->payFromWallet($invoice, $walletBalanceKobo, $client, $walletService, $reconciler);
                $invoice = $invoice->fresh();
                $remainingKobo = $invoice->outstanding_amount_kobo;

                if ($remainingKobo > 0) {
                    $this->chargeCard($invoice, $card, $remainingKobo, $email, $chargeService, $reconciler);
                }

                $this->onSuccess($service, $invoice->fresh(), 'wallet_and_card', $notifier);

                return;
            }

            if ($card) {
                $this->chargeCard($invoice, $card, $outstandingKobo, $email, $chargeService, $reconciler);
                $this->onSuccess($service, $invoice->fresh(), 'card', $notifier);

                return;
            }

            $this->onFailure($service, $invoice, 'no_saved_card_enabled_for_auto_renewal', $notifier);
        } catch (InsufficientWalletBalanceException $exception) {
            $this->onFailure($service, $invoice, 'wallet_debit_failed: '.$exception->getMessage(), $notifier);
        } catch (PaymentGatewayException $exception) {
            $this->onFailure($service, $invoice, 'card_charge_failed: '.$exception->getMessage(), $notifier);
        } catch (Throwable $exception) {
            $this->onFailure($service, $invoice, 'payment_provider_error: '.$exception->getMessage(), $notifier);
        }
    }

    private function payFromWallet(Invoice $invoice, int $amountKobo, Client $client, WalletService $walletService, ReconcileInvoicePaymentService $reconciler): void
    {
        $reference = 'AUTORENEW-WALLET-'.Str::upper(Str::random(10));

        $walletService->debit($client, $amountKobo, 'auto_renewal_payment', [
            'invoice_id' => $invoice->id,
            'payment_reference' => $reference,
            'description' => "Auto-renewal wallet payment toward invoice {$invoice->invoice_number}",
        ]);

        $payment = Payment::query()->create([
            'client_id' => $client->id,
            'invoice_id' => $invoice->id,
            'gateway' => 'wallet',
            'purpose' => 'invoice_payment',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $amountKobo,
            'currency' => 'NGN',
        ]);

        $reconciler->reconcile($invoice, $payment, $amountKobo, 'wallet', ['source' => 'queue', 'skip_notification' => true]);
    }

    private function chargeCard(Invoice $invoice, SavedPaymentMethod $card, int $amountKobo, ?string $email, ChargeSavedCardService $chargeService, ReconcileInvoicePaymentService $reconciler): void
    {
        $reference = 'AUTORENEW-'.strtoupper($card->payment_provider).'-'.Str::upper(Str::random(10));

        $payment = Payment::query()->create([
            'client_id' => $card->client_id,
            'invoice_id' => $invoice->id,
            'gateway' => $card->payment_provider,
            'purpose' => 'invoice_payment',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $amountKobo,
            'currency' => 'NGN',
        ]);

        $result = $chargeService->charge($card, $amountKobo, $reference, $email ?: 'billing@naitalk.com');

        if (! $result['successful']) {
            $payment->forceFill(['status' => 'failed', 'gateway_payload' => $result['raw'] ?? []])->save();

            throw new PaymentGatewayException('The saved card charge was declined.');
        }

        $reconciler->reconcile($invoice->fresh(), $payment, $result['amount_kobo'], $card->payment_provider, [
            'source' => 'queue',
            'gateway_payload' => $result['raw'],
            'skip_notification' => true,
        ]);
    }

    private function onSuccess(HostingService $service, Invoice $invoice, string $method, ClientNotifier $notifier): void
    {
        if ($invoice->status !== 'paid') {
            // Split payment didn't fully close the invoice (e.g. card charge
            // partially failed after the wallet leg succeeded) — nothing more
            // to do here; the next daily run will retry the remaining balance.
            return;
        }

        $cycle = $service->billing_cycle === 'monthly' ? now()->addMonth() : now()->addYear();

        $service->forceFill([
            'renews_at' => $cycle->toDateString(),
            'next_due_date' => $cycle->toDateString(),
            'grace_period_ends_at' => null,
            'scheduled_deletion_at' => null,
        ])->save();

        $notifier->notify(
            client: $service->client,
            notification: new NaiTalkAutoRenewalSuccess($invoice, $method),
            template: 'auto_renewal_success',
            subject: 'Your NAI TALK hosting was renewed successfully',
            service: $service,
        );
    }

    private function onFailure(HostingService $service, Invoice $invoice, string $reason, ClientNotifier $notifier): void
    {
        AuditLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'invoice_id' => $invoice->id,
            'action' => 'auto_renewal_failed',
            'reason' => $reason,
            'source' => 'queue',
            'notify_client' => true,
            'error_details' => $reason,
        ]);

        $notifier->notify(
            client: $service->client,
            notification: $reason === 'no_saved_card_enabled_for_auto_renewal' || $reason === 'no_saved_card'
                ? new NaiTalkRenewalPaymentReminder($invoice)
                : new NaiTalkAutoRenewalFailed($invoice, $reason),
            template: 'auto_renewal_failed',
            subject: 'Action required: your NAI TALK hosting renewal payment failed',
            service: $service,
        );

        $this->escalateIfRepeated($service, $invoice);
    }

    private function escalateIfRepeated(HostingService $service, Invoice $invoice): void
    {
        $threshold = (int) config('hosting_lifecycle.auto_renewal_failure_escalation_threshold', 3);

        $failureCount = AuditLog::query()
            ->where('hosting_service_id', $service->id)
            ->where('invoice_id', $invoice->id)
            ->where('action', 'auto_renewal_failed')
            ->count();

        if ($failureCount < $threshold) {
            return;
        }

        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty()) {
            return;
        }

        NotificationFacade::send($admins, new ClientNotificationFailed(
            $service->client,
            'auto_renewal_repeated_failure',
            "Repeated auto-renewal failures for service {$service->service_number}",
            "{$failureCount} consecutive auto-renewal failures on invoice {$invoice->invoice_number}."
        ));
    }
}
