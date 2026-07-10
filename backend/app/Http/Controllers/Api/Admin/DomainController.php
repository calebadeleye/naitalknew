<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RetryFailedDomainRegistrationJob;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\DomainTransfer;
use App\Models\HostingService;
use App\Notifications\ExistingDomainDnsInstructions;
use App\Services\Domains\DomainOrderService;
use App\Services\Domains\SpaceshipDomainSyncService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Admin domain management actions (spec §7). The admin listing views
 * themselves live in RecordsController alongside invoices/payments; this
 * controller is only the action endpoints.
 */
class DomainController extends Controller
{
    public function retryRegistration(DomainOrder $domainOrder)
    {
        abort_if($domainOrder->status !== 'failed', 422, 'Only a failed domain order can be retried.');

        RetryFailedDomainRegistrationJob::dispatch($domainOrder->id);

        return response()->json(['message' => 'Domain registration retry has been queued.']);
    }

    public function retryTransferSync(DomainTransfer $transfer, SpaceshipDomainSyncService $syncService)
    {
        $domain = $transfer->domain;

        abort_if(! $domain, 404, 'This transfer has no associated domain record.');

        $syncService->syncDomain($domain);

        return response()->json(['message' => 'Transfer status sync requested.', 'transfer' => $transfer->fresh()]);
    }

    public function markSource(Request $request, Domain $domain)
    {
        $payload = $request->validate([
            'source' => ['required', Rule::in(['external', 'manual'])],
        ]);

        $domain->forceFill([
            'source' => $payload['source'],
            'provider' => $payload['source'],
        ])->save();

        return response()->json(['data' => $domain->fresh()]);
    }

    public function linkHosting(Request $request, Domain $domain)
    {
        $payload = $request->validate([
            'hosting_service_id' => ['required', 'integer', 'exists:hosting_services,id'],
        ]);

        $service = HostingService::query()->where('client_id', $domain->client_id)->findOrFail($payload['hosting_service_id']);

        $domain->forceFill(['linked_hosting_service_id' => $service->id])->save();

        return response()->json(['data' => $domain->fresh('linkedHostingService')]);
    }

    public function unlinkHosting(Domain $domain)
    {
        $domain->forceFill(['linked_hosting_service_id' => null])->save();

        return response()->json(['data' => $domain->fresh()]);
    }

    public function sendDnsInstructions(Domain $domain)
    {
        $service = $domain->linkedHostingService;

        abort_if(! $service, 422, 'This domain has no linked hosting service to send DNS instructions for.');

        $domain->client->user?->notify(new ExistingDomainDnsInstructions($service));

        return response()->json(['message' => 'DNS instructions email sent.']);
    }

    public function renew(Domain $domain, DomainOrderService $domainOrders)
    {
        try {
            if (! $domainOrders->hasPendingRenewalOrder($domain)) {
                $domainOrders->createRenewalOrder($domain);
            }
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $domainOrder = $domain->orders()->where('order_type', 'renewal')->where('status', 'pending_payment')->latest()->first();

        return response()->json(['invoice_number' => $domainOrder?->invoice?->invoice_number]);
    }

    public function disableAutoRenew(Domain $domain)
    {
        $domain->forceFill(['auto_renew' => false])->save();

        return response()->json(['data' => $domain->fresh()]);
    }
}
