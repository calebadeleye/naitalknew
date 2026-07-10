<?php

namespace App\Services\Domains;

use App\Jobs\InitiateDomainTransferJob;
use App\Jobs\RegisterDomainWithSpaceshipJob;
use App\Models\DomainOrder;
use App\Models\DomainTransfer;
use App\Models\Invoice;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Support\Collection;

/**
 * The one seam between payment reconciliation and domain registration/
 * transfer, called from ReconcileInvoicePaymentService once an invoice is
 * paid. For a hosting service (or invoice) with no associated DomainOrder,
 * this does exactly what happened before domains existed: queue
 * provisioning directly — so every pre-existing hosting-only order behaves
 * identically to today. For one *with* a DomainOrder, the domain is
 * registered/transferred first; hosting is only ever provisioned after
 * that succeeds (see RegisterDomainWithSpaceshipJob).
 */
class DomainOrderDispatcher
{
    public function __construct(private readonly IspConfigProvisioningService $provisioning)
    {
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

        RegisterDomainWithSpaceshipJob::dispatch($domainOrder->id);
    }
}
