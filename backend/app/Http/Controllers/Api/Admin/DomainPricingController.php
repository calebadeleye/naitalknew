<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncSpaceshipTldPricesJob;
use App\Models\AuditLog;
use App\Models\DomainPricing;
use App\Models\DomainPricingSyncLog;
use App\Services\Billing\Money;
use App\Services\Domains\DomainPricingService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DomainPricingController extends Controller
{
    public function __construct(private readonly DomainPricingService $pricingService)
    {
    }

    public function index()
    {
        return response()->json([
            'data' => DomainPricing::query()
                ->orderByDesc('status')
                ->orderBy('tld')
                ->get()
                ->map(fn (DomainPricing $pricing) => $this->serialize($pricing)),
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validatePayload($request);
        $pricing = DomainPricing::query()->create($payload);

        return response()->json($this->serialize($pricing), 201);
    }

    public function update(Request $request, DomainPricing $domainPricing)
    {
        $before = $domainPricing->only(['markup_type', 'markup_value_kobo', 'markup_percent', 'fixed_customer_price_kobo', 'status']);
        $payload = $this->validatePayload($request, $domainPricing);
        $domainPricing->update($payload);
        $domainPricing->refresh();

        $this->logMarkupChangeIfAny($request, $domainPricing, $before);

        return response()->json($this->serialize($domainPricing));
    }

    public function destroy(DomainPricing $domainPricing)
    {
        $domainPricing->forceFill(['status' => 'inactive'])->save();

        return response()->json($this->serialize($domainPricing->refresh()));
    }

    /**
     * Manually triggers a Spaceship TLD price sync. Dispatched through the
     * queue like every other domain job — runs inline under the sync queue
     * driver (tests, or a small deployment with no worker), or in the
     * background once a queue worker is running.
     */
    public function sync(Request $request)
    {
        SyncSpaceshipTldPricesJob::dispatch('manual');

        return response()->json(['message' => 'Domain TLD price sync has been queued.']);
    }

    public function syncLogs()
    {
        return response()->json([
            'data' => DomainPricingSyncLog::query()
                ->latest('started_at')
                ->limit(50)
                ->get(),
        ]);
    }

    private function logMarkupChangeIfAny(Request $request, DomainPricing $pricing, array $before): void
    {
        $after = $pricing->only(['markup_type', 'markup_value_kobo', 'markup_percent', 'fixed_customer_price_kobo', 'status']);

        if ($before === $after) {
            return;
        }

        AuditLog::query()->create([
            'staff_user_id' => $request->user()?->id,
            'action' => 'domain_pricing_updated',
            'reason' => "Admin updated {$pricing->tld} pricing configuration.",
            'before_state' => $before,
            'after_state' => $after,
        ]);
    }

    private function validatePayload(Request $request, ?DomainPricing $domainPricing = null): array
    {
        $payload = $request->validate([
            'tld' => ['required', 'string', 'max:30', Rule::unique('domain_pricing', 'tld')->ignore($domainPricing)],
            'provider' => ['nullable', 'string', 'max:60'],
            'currency' => ['nullable', 'string', 'max:3'],
            'registration_price_kobo' => ['required', 'integer', 'min:0'],
            'renewal_price_kobo' => ['required', 'integer', 'min:0'],
            'transfer_price_kobo' => ['required', 'integer', 'min:0'],
            'markup_type' => ['required', Rule::in(['cost_plus_markup', 'percentage_markup', 'fixed_customer_price', 'manual_price'])],
            'markup_value_kobo' => ['nullable', 'integer', 'min:0'],
            'markup_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'fixed_customer_price_kobo' => ['nullable', 'integer', 'min:0'],
            'status' => ['required', Rule::in(['needs_review', 'active', 'inactive'])],
        ]);

        // A TLD can silently vanish from every public pricing endpoint if it's
        // marked active without a usable cost basis (DomainPricingService::priceFor
        // just returns null for it). Block that combination here instead of
        // relying on the admin noticing the informational `is_ready` flag.
        if ($payload['status'] === 'active') {
            $preview = ($domainPricing ? $domainPricing->replicate() : new DomainPricing)->forceFill($payload);

            if (! $preview->hasUsableCostBasis()) {
                throw ValidationException::withMessages([
                    'status' => 'This TLD cannot be marked active without a usable cost basis — set a fixed customer price, or sync/enter an exchange rate first (cost-plus/percentage markup).',
                ]);
            }
        }

        return $payload;
    }

    private function serialize(DomainPricing $pricing): array
    {
        $isReady = $pricing->hasUsableCostBasis();

        return [
            'id' => $pricing->id,
            'tld' => $pricing->tld,
            'provider' => $pricing->provider,

            // Spaceship's own cost — shown to admin only, never to customers.
            'provider_currency' => $pricing->provider_currency,
            'provider_registration_price_minor' => $pricing->provider_registration_price_minor,
            'provider_registration_price' => $this->formatProviderPrice($pricing, $pricing->provider_registration_price_minor),
            'provider_renewal_price_minor' => $pricing->provider_renewal_price_minor,
            'provider_renewal_price' => $this->formatProviderPrice($pricing, $pricing->provider_renewal_price_minor),
            'provider_transfer_price_minor' => $pricing->provider_transfer_price_minor,
            'provider_transfer_price' => $this->formatProviderPrice($pricing, $pricing->provider_transfer_price_minor),

            // FX conversion (copied from global settings at last sync time).
            'exchange_rate_to_ngn' => $pricing->exchange_rate_to_ngn === null ? null : (float) $pricing->exchange_rate_to_ngn,
            'safety_buffer_percent' => (float) $pricing->safety_buffer_percent,

            // Converted NGN cost basis (registration/renewal/transfer) — what markup is applied to.
            'currency' => $pricing->currency,
            'registration_price_kobo' => $pricing->registration_price_kobo,
            'registration_price' => Money::naira($pricing->registration_price_kobo),
            'renewal_price_kobo' => $pricing->renewal_price_kobo,
            'renewal_price' => Money::naira($pricing->renewal_price_kobo),
            'transfer_price_kobo' => $pricing->transfer_price_kobo,
            'transfer_price' => Money::naira($pricing->transfer_price_kobo),

            // Markup configuration — the only thing admin normally edits.
            'markup_type' => $pricing->markup_type,
            'markup_value_kobo' => $pricing->markup_value_kobo,
            'markup_percent' => $pricing->markup_percent === null ? null : (float) $pricing->markup_percent,
            'fixed_customer_price_kobo' => $pricing->fixed_customer_price_kobo,

            // Final customer price (before VAT — VAT is added at checkout/invoice).
            'is_ready' => $isReady,
            'customer_registration_price_kobo' => $isReady ? $this->pricingService->customerPrice($pricing, (int) $pricing->registration_price_kobo) : null,
            'customer_registration_price' => $isReady ? Money::naira($this->pricingService->customerPrice($pricing, (int) $pricing->registration_price_kobo)) : null,
            'customer_renewal_price_kobo' => $isReady ? $this->pricingService->customerPrice($pricing, (int) $pricing->renewal_price_kobo) : null,
            'customer_renewal_price' => $isReady ? Money::naira($this->pricingService->customerPrice($pricing, (int) $pricing->renewal_price_kobo)) : null,
            'customer_transfer_price_kobo' => $isReady ? $this->pricingService->customerPrice($pricing, (int) $pricing->transfer_price_kobo) : null,
            'customer_transfer_price' => $isReady ? Money::naira($this->pricingService->customerPrice($pricing, (int) $pricing->transfer_price_kobo)) : null,

            'status' => $pricing->status,
            'last_synced_at' => $pricing->last_synced_at?->toIso8601String(),
            'last_sync_status' => $pricing->last_sync_status,
            'last_sync_error' => $pricing->last_sync_error,
        ];
    }

    private function formatProviderPrice(DomainPricing $pricing, ?int $minorUnits): ?string
    {
        if ($minorUnits === null) {
            return null;
        }

        return $pricing->provider_currency.' '.number_format($minorUnits / 100, 2);
    }
}
