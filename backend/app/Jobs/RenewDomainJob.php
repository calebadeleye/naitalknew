<?php

namespace App\Jobs;

use App\Exceptions\InsufficientWalletBalanceException;
use App\Exceptions\PaymentGatewayException;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\SavedPaymentMethod;
use App\Models\User;
use App\Notifications\ClientNotificationFailed;
use App\Notifications\NaiTalkDomainAutoRenewalFailed;
use App\Notifications\NaiTalkDomainAutoRenewalSuccess;
use App\Notifications\NaiTalkDomainRegistrarRenewalPending;
use App\Notifications\NaiTalkDomainRenewalReminder;
use App\Services\Domains\DomainOrderService;
use App\Services\Domains\Registrars\Data\DomainOperationStatus;
use App\Services\Domains\Registrars\RegistrarResolver;
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
 * Daily sweep for domain auto-renewal — same wallet-first, then
 * wallet+enabled-card-split, then full-card priority as
 * ProcessAutoRenewalPaymentJob, reusing the exact same WalletService/
 * ChargeSavedCardService/ReconcileInvoicePaymentService. Domain renewal
 * with Spaceship only ever happens after the renewal invoice is fully paid.
 */
class RenewDomainJob implements ShouldQueue
{
    use Queueable;

    public function handle(
        DomainOrderService $domainOrders,
        WalletService $walletService,
        SavedPaymentMethodService $savedMethods,
        ChargeSavedCardService $chargeService,
        ReconcileInvoicePaymentService $reconciler,
        RegistrarResolver $registrars,
        ClientNotifier $notifier,
    ): void {
        $leadDays = (int) config('hosting_lifecycle.domain_renewal_lead_days', 14);
        $targetDate = now()->addDays($leadDays)->toDateString();

        Domain::query()
            ->where('auto_renew', true)
            ->where('status', 'active')
            // Unassigned/internal domains (client_id null) must never be
            // auto-invoiced — there's no client to bill.
            ->whereNotNull('client_id')
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<=', $targetDate)
            ->whereDate('expires_at', '>=', now()->toDateString())
            ->get()
            ->each(fn (Domain $domain) => $this->attempt(
                $domain, $domainOrders, $walletService, $savedMethods, $chargeService, $reconciler, $registrars, $notifier
            ));
    }

    private function attempt(
        Domain $domain,
        DomainOrderService $domainOrders,
        WalletService $walletService,
        SavedPaymentMethodService $savedMethods,
        ChargeSavedCardService $chargeService,
        ReconcileInvoicePaymentService $reconciler,
        RegistrarResolver $registrars,
        ClientNotifier $notifier,
    ): void {
        if (! $domainOrders->hasPendingRenewalOrder($domain)) {
            $domainOrders->createRenewalOrder($domain);
        }

        $domainOrder = DomainOrder::query()
            ->where('domain_id', $domain->id)
            ->where('order_type', 'renewal')
            ->where('status', 'pending_payment')
            ->latest()
            ->first();

        if (! $domainOrder || ! $domainOrder->invoice) {
            return;
        }

        $invoice = $domainOrder->invoice->fresh();

        if ($invoice->status === 'paid') {
            return;
        }

        $client = $domain->client;
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
            } elseif ($walletBalanceKobo > 0 && $card) {
                $this->payFromWallet($invoice, $walletBalanceKobo, $client, $walletService, $reconciler);
                $invoice = $invoice->fresh();
                $remainingKobo = $invoice->outstanding_amount_kobo;

                if ($remainingKobo > 0) {
                    $this->chargeCard($invoice, $card, $remainingKobo, $email, $chargeService, $reconciler);
                }
            } elseif ($card) {
                $this->chargeCard($invoice, $card, $outstandingKobo, $email, $chargeService, $reconciler);
            } else {
                $this->onFailure($domain, $domainOrder, 'no_saved_card_enabled_for_auto_renewal', $notifier, isReminder: true);

                return;
            }
        } catch (InsufficientWalletBalanceException $exception) {
            $this->onFailure($domain, $domainOrder, 'wallet_debit_failed: '.$exception->getMessage(), $notifier);

            return;
        } catch (PaymentGatewayException $exception) {
            $this->onFailure($domain, $domainOrder, 'card_charge_failed: '.$exception->getMessage(), $notifier);

            return;
        } catch (Throwable $exception) {
            $this->onFailure($domain, $domainOrder, 'payment_provider_error: '.$exception->getMessage(), $notifier);

            return;
        }

        $invoice = $invoice->fresh();

        if ($invoice->status !== 'paid') {
            // Split payment didn't fully close the invoice; retry tomorrow.
            return;
        }

        $registrar = $registrars->resolve($domain);

        try {
            $result = $registrar->renew($domain->domain_name, 1);
        } catch (Throwable $exception) {
            // Payment succeeded but the registrar renew call itself failed —
            // never silently drop this: keep the DomainOrder pending-payment
            // status as-is (it's already paid; this is a provider-side
            // failure, not a billing one) and let admin retry manually.
            AuditLog::query()->create([
                'client_id' => $domain->client_id,
                'action' => 'domain_renewal_provider_call_failed',
                'reason' => "Domain {$domain->domain_name} renewal payment succeeded but the {$domain->provider} renew call failed: {$exception->getMessage()}",
                'source' => 'queue',
                'notify_client' => false,
                'error_details' => $exception->getMessage(),
            ]);
            $domain->forceFill(['registrar_operation_status' => 'failed'])->save();
            $this->notifyAdminsOfRepeatedFailure($domain, "Renewal payment succeeded but the {$domain->provider} renew call failed: {$exception->getMessage()}");

            return;
        }

        if (! $result->successful && $result->status === DomainOperationStatus::Failed) {
            AuditLog::query()->create([
                'client_id' => $domain->client_id,
                'action' => 'domain_renewal_provider_call_failed',
                'reason' => "Domain {$domain->domain_name} renewal payment succeeded but the {$domain->provider} renew call reported failure: {$result->errorMessage}",
                'source' => 'queue',
                'notify_client' => false,
                'error_details' => $result->errorMessage,
            ]);
            $domain->forceFill(['registrar_operation_status' => 'failed'])->save();
            $this->notifyAdminsOfRepeatedFailure($domain, "Renewal payment succeeded but the {$domain->provider} renew call reported failure: {$result->errorMessage}");

            return;
        }

        // The order itself is marked completed only once the registrar has
        // actually confirmed the renewal (Completed) — for a provider whose
        // renew() is asynchronous (Pending/Processing), the order and
        // domain stay in their current state and a follow-up sync finalizes
        // things once the registrar confirms (see CloudflareDomainSyncApplier).
        if ($result->status !== DomainOperationStatus::Completed) {
            $domain->forceFill(['registrar_operation_status' => 'pending'])->save();

            // Only reached once per renewal cycle — subsequent runs hit the
            // "$invoice->status === 'paid'" early return above before ever
            // getting here again, so no extra dedup is needed.
            $notifier->notify(
                client: $client,
                notification: new NaiTalkDomainRegistrarRenewalPending($domain),
                template: 'domain_registrar_renewal_pending',
                subject: "Your domain {$domain->domain_name} renewal payment was received",
            );

            return;
        }

        $domainOrder->forceFill(['status' => 'completed'])->save();
        $domain->forceFill(['registrar_operation_status' => 'completed'])->save();

        $method = $walletBalanceKobo >= $outstandingKobo ? 'wallet' : ($walletBalanceKobo > 0 && $card ? 'wallet_and_card' : 'card');

        $notifier->notify(
            client: $client,
            notification: new NaiTalkDomainAutoRenewalSuccess($domain, $method),
            template: 'domain_auto_renewal_success',
            subject: "Your domain {$domain->domain_name} was renewed successfully",
        );
    }

    private function payFromWallet(Invoice $invoice, int $amountKobo, Client $client, WalletService $walletService, ReconcileInvoicePaymentService $reconciler): void
    {
        $reference = 'DOMAINRENEW-WALLET-'.Str::upper(Str::random(10));

        $walletService->debit($client, $amountKobo, 'auto_renewal_payment', [
            'invoice_id' => $invoice->id,
            'payment_reference' => $reference,
            'description' => "Domain auto-renewal wallet payment toward invoice {$invoice->invoice_number}",
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
        $reference = 'DOMAINRENEW-'.strtoupper($card->payment_provider).'-'.Str::upper(Str::random(10));

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

    private function onFailure(Domain $domain, DomainOrder $domainOrder, string $reason, ClientNotifier $notifier, bool $isReminder = false): void
    {
        AuditLog::query()->create([
            'client_id' => $domain->client_id,
            'action' => 'domain_auto_renewal_failed',
            'reason' => $reason,
            'source' => 'queue',
            'notify_client' => true,
            'error_details' => $reason,
        ]);

        $client = $domain->client;

        $notifier->notify(
            client: $client,
            notification: $isReminder
                ? new NaiTalkDomainRenewalReminder($domain)
                : new NaiTalkDomainAutoRenewalFailed($domain, $reason),
            template: 'domain_auto_renewal_failed',
            subject: "Action required: your domain {$domain->domain_name} renewal payment failed",
        );

        $threshold = (int) config('hosting_lifecycle.auto_renewal_failure_escalation_threshold', 3);
        $failureCount = AuditLog::query()
            ->where('client_id', $domain->client_id)
            ->where('action', 'domain_auto_renewal_failed')
            ->where('reason', $reason)
            ->count();

        if ($failureCount >= $threshold) {
            $this->notifyAdminsOfRepeatedFailure($domain, "{$failureCount} consecutive auto-renewal failures: {$reason}");
        }
    }

    private function notifyAdminsOfRepeatedFailure(Domain $domain, string $summary): void
    {
        $client = $domain->client;
        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty() || ! $client) {
            return;
        }

        NotificationFacade::send($admins, new ClientNotificationFailed(
            $client,
            'domain_auto_renewal_repeated_failure',
            "Repeated auto-renewal failures for domain {$domain->domain_name}",
            $summary,
        ));
    }
}
