<?php

namespace App\Services\Domains;

use App\Jobs\InitiateDomainTransferJob;
use App\Models\DomainOrder;
use App\Models\DomainTransfer;
use App\Models\Invoice;
use App\Models\User;
use App\Notifications\AdminDomainAwaitingManualRegistration;
use App\Notifications\NaiTalkDomainOrderAwaitingRegistration;
use App\Services\Notifications\ClientNotifier;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification as NotificationFacade;

/**
 * The one seam between payment reconciliation and domain registration/
 * transfer, called from ReconcileInvoicePaymentService once an invoice is
 * paid. For a hosting service (or invoice) with no associated DomainOrder,
 * this does exactly what happened before domains existed: queue
 * provisioning directly — so every pre-existing hosting-only order behaves
 * identically to today. For one *with* a DomainOrder, the domain is
 * registered/transferred first; hosting is only ever provisioned after
 * that succeeds.
 *
 * Registration is manual: Spaceship is used only to check availability, not
 * to register domains. A registration order is flipped to
 * awaiting_manual_registration here and an admin completes it later via
 * Admin\DomainController::markRegistered(). Transfers are unaffected — those
 * still go through Spaceship automatically via InitiateDomainTransferJob.
 */
class DomainOrderDispatcher
{
    public function __construct(
        private readonly IspConfigProvisioningService $provisioning,
        private readonly ClientNotifier $notifier = new ClientNotifier,
    ) {
    }

    /**
     * @param  Collection<int, \App\Models\HostingService>  $servicesToProvision
     */
    public function dispatchForPaidInvoice(Invoice $invoice, Collection $servicesToProvision): void
    {
        foreach ($servicesToProvision as $service) {
            $domainOrder = $this->domainOrderFor($service->id);

            if ($domainOrder) {
                // Idempotency: a domain order already past pending_payment is
                // either in flight or finished — its own job/dispatch owns
                // provisioning for this service, never dispatch it again here.
                if ($domainOrder->status === 'pending_payment') {
                    $this->dispatchDomainOrder($domainOrder);
                }

                continue;
            }

            $this->provisioning->queueProvisioning($service);
        }

        if (! $invoice->order_id) {
            return;
        }

        // Domain-only orders (Flow 1 registration, Flow 4 transfer) have no
        // hosting service, so they're never touched by the loop above.
        $domainOnlyOrders = DomainOrder::query()
            ->where('order_id', $invoice->order_id)
            ->whereNull('hosting_service_id')
            ->where('status', 'pending_payment')
            ->get();

        foreach ($domainOnlyOrders as $domainOrder) {
            $this->dispatchDomainOrder($domainOrder);
        }
    }

    private function domainOrderFor(int $hostingServiceId): ?DomainOrder
    {
        return DomainOrder::query()
            ->where('hosting_service_id', $hostingServiceId)
            ->whereIn('order_type', ['registration', 'transfer'])
            ->latest()
            ->first();
    }

    private function dispatchDomainOrder(DomainOrder $domainOrder): void
    {
        $domainOrder->forceFill(['status' => 'payment_confirmed'])->save();

        if ($domainOrder->order_type === 'transfer') {
            $transfer = DomainTransfer::query()
                ->where('invoice_id', $domainOrder->invoice_id)
                ->where('domain_id', $domainOrder->domain_id)
                ->latest()
                ->first();

            if ($transfer) {
                InitiateDomainTransferJob::dispatch($transfer->id);
            }

            return;
        }

        $this->markAwaitingManualRegistration($domainOrder);
    }

    private function markAwaitingManualRegistration(DomainOrder $domainOrder): void
    {
        $domainOrder->forceFill(['status' => 'awaiting_manual_registration'])->save();

        $domain = $domainOrder->domain;
        $domain?->forceFill(['registration_status' => 'awaiting_manual_registration'])->save();

        $client = $domainOrder->client;

        if ($client && $domain) {
            $this->notifier->notify(
                client: $client,
                notification: new NaiTalkDomainOrderAwaitingRegistration($domain),
                template: 'domain_order_awaiting_registration',
                subject: "Payment received for {$domainOrder->domain_name}",
                domain: $domainOrder->domain_name,
            );
        }

        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isNotEmpty()) {
            NotificationFacade::send($admins, new AdminDomainAwaitingManualRegistration($domainOrder));
        }
    }
}
