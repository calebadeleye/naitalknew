<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Domain;
use App\Services\Domains\DomainOrderService;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Client-facing Domains dashboard (spec §6). Presents customer-friendly
 * labels — never raw Spaceship API data.
 */
class DomainController extends Controller
{
    private const SOURCE_LABELS = [
        'spaceship_registered' => 'Registered with NAI TALK',
        'spaceship_transferred' => 'Transferred to NAI TALK',
        'external' => 'External domain',
        'manual' => 'Manually managed',
    ];

    private const PROVIDER_LABELS = [
        'spaceship' => 'Spaceship',
        'external' => 'External',
        'manual' => 'Manual',
    ];

    public function index(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $domains = Domain::query()
            ->where('client_id', $client->id)
            ->with('linkedHostingService')
            ->latest()
            ->get()
            ->map(fn (Domain $domain) => $this->present($domain));

        return response()->json(['data' => $domains]);
    }

    public function show(Request $request, Domain $domain)
    {
        $this->authorizeDomain($request, $domain);

        return response()->json($this->present($domain->load('linkedHostingService')));
    }

    public function updateAutoRenew(Request $request, Domain $domain)
    {
        $this->authorizeDomain($request, $domain);

        $payload = $request->validate(['auto_renew' => ['required', 'boolean']]);

        $domain->forceFill(['auto_renew' => $payload['auto_renew']])->save();

        return response()->json($this->present($domain->fresh('linkedHostingService')));
    }

    /**
     * Flow 5: Buy Hosting Later.
     */
    public function addHosting(Request $request, Domain $domain, DomainOrderService $domainOrders)
    {
        $this->authorizeDomain($request, $domain);

        $payload = $request->validate([
            'plan_slug' => ['required', 'string', 'exists:hosting_plans,slug'],
            'billing_cycle' => ['required', 'in:monthly,annual'],
            'add_ons' => ['array'],
            'add_ons.*' => ['string', 'exists:hosting_add_ons,slug'],
            'auto_renew' => ['boolean'],
            'payment_gateway' => ['nullable', 'in:paystack,flutterwave'],
        ]);

        try {
            return response()->json($domainOrders->addHostingToDomain($domain->client, $domain, $payload), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /**
     * Generates (or reuses) the domain's renewal invoice so the client can
     * pay it through the normal invoice payment flow (wallet/card/gateway/
     * bank transfer) — the actual Spaceship renewal call only ever happens
     * after that invoice is fully paid (see RenewDomainJob).
     */
    public function renew(Request $request, Domain $domain, DomainOrderService $domainOrders)
    {
        $this->authorizeDomain($request, $domain);

        try {
            if (! $domainOrders->hasPendingRenewalOrder($domain)) {
                $domainOrders->createRenewalOrder($domain);
            }
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $domainOrder = $domain->orders()->where('order_type', 'renewal')->where('status', 'pending_payment')->latest()->first();

        return response()->json([
            'invoice_number' => $domainOrder?->invoice?->invoice_number,
            'order_number' => null,
        ]);
    }

    private function authorizeDomain(Request $request, Domain $domain): void
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');
        abort_if($domain->client_id !== $client->id, 403, 'This domain does not belong to your account.');
    }

    private function present(Domain $domain): array
    {
        $hostingService = $domain->linkedHostingService;
        $daysToExpiry = $domain->expires_at ? now()->startOfDay()->diffInDays($domain->expires_at, false) : null;

        return [
            'id' => $domain->id,
            'domain_name' => $domain->domain_name,
            'tld' => $domain->tld,
            'source' => $domain->source,
            'source_label' => self::SOURCE_LABELS[$domain->source] ?? ucfirst($domain->source),
            'provider_label' => self::PROVIDER_LABELS[$domain->provider] ?? ucfirst($domain->provider),
            'status' => $domain->status,
            'registration_status' => $domain->registration_status,
            'transfer_status' => $domain->transfer_status,
            'registered_at' => $domain->registered_at?->toDateString(),
            'expires_at' => $domain->expires_at?->toDateString(),
            'days_to_expiry' => $daysToExpiry,
            'renewal_due' => $daysToExpiry !== null && $daysToExpiry <= 30,
            'auto_renew' => $domain->auto_renew,
            'linked_hosting_service' => $hostingService ? [
                'id' => $hostingService->id,
                'service_number' => $hostingService->service_number,
                'status' => $hostingService->status,
            ] : null,
            'can_add_hosting' => $hostingService === null && $domain->status === 'active',
            'shows_dns_instructions' => $domain->source === 'external',
            'server_hostname' => $domain->source === 'external' ? config('ispconfig.public_hostname') : null,
        ];
    }
}
