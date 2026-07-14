<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\DomainTransfer;
use App\Models\HostingService;
use App\Notifications\ExistingDomainDnsInstructions;
use App\Notifications\NaiTalkDomainRegistrationConfirmed;
use App\Services\Domains\DomainOrderService;
use App\Services\Domains\Registrars\AutoRenewToggleService;
use App\Services\Domains\SpaceshipDomainSyncService;
use App\Services\Notifications\ClientNotifier;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Admin domain management actions (spec §7). The admin listing views
 * themselves live in RecordsController alongside invoices/payments; this
 * controller is only the action endpoints.
 */
class DomainController extends Controller
{
    /**
     * Domain registration is manual (Spaceship is availability-check only) —
     * an admin registers the domain elsewhere, then calls this to flip the
     * order/domain to active and notify the customer.
     */
    public function markRegistered(Request $request, DomainOrder $domainOrder, ClientNotifier $notifier, IspConfigProvisioningService $provisioning)
    {
        abort_if($domainOrder->status !== 'awaiting_manual_registration', 422, 'Only a domain order awaiting manual registration can be marked registered.');

        $payload = $request->validate([
            'expires_at' => ['required', 'date', 'after:today'],
        ]);

        $domain = $domainOrder->domain;

        abort_if(! $domain, 422, 'This domain order has no associated domain record.');

        $domain->forceFill([
            'status' => 'active',
            'registration_status' => 'registered',
            'registered_at' => now()->toDateString(),
            'expires_at' => Carbon::parse($payload['expires_at'])->toDateString(),
        ])->save();

        $domainOrder->forceFill(['status' => 'completed'])->save();

        // A domain+hosting combo order links its hosting service at checkout
        // time but never provisions it until the domain is confirmed
        // registered — that gate now happens here instead of in the deleted
        // auto-registration job.
        if ($domainOrder->hosting_service_id && $domainOrder->hostingService) {
            $provisioning->queueProvisioning($domainOrder->hostingService);
        }

        $client = $domainOrder->client;

        if ($client) {
            $notifier->notify(
                client: $client,
                notification: new NaiTalkDomainRegistrationConfirmed($domain),
                template: 'domain_registration_confirmed',
                subject: "Your domain {$domainOrder->domain_name} is registered",
                domain: $domainOrder->domain_name,
            );
        }

        return response()->json(['data' => $domainOrder->fresh(['domain'])]);
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
        abort_if(! $domain->client, 422, 'This domain has no assigned client to notify.');

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

    public function disableAutoRenew(Domain $domain, AutoRenewToggleService $autoRenewToggle)
    {
        $autoRenewToggle->toggle($domain, false);

        return response()->json(['data' => $domain->fresh()]);
    }

    public function addNote(Request $request, Domain $domain)
    {
        $payload = $request->validate([
            'assignment_note' => ['required', 'string', 'max:2000'],
        ]);

        $domain->forceFill(['assignment_note' => $payload['assignment_note']])->save();

        return response()->json(['data' => $domain->fresh()]);
    }

    public function syncLogs(Domain $domain)
    {
        $logs = $domain->syncLogs()->latest()->limit(20)->get([
            'id', 'provider', 'action', 'status', 'response_code', 'error_message', 'started_at', 'completed_at', 'created_at',
        ]);

        return response()->json(['data' => $logs]);
    }
}
