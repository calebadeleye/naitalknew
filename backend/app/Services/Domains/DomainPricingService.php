<?php

namespace App\Services\Domains;

use App\Models\DomainPricing;
use App\Services\Billing\VatCalculator;

/**
 * Single source of truth for what a customer pays for a domain — mirrors
 * VatCalculator's role for hosting. Raw Spaceship cost is never shown to a
 * customer directly; it always passes through the configured markup first.
 */
class DomainPricingService
{
    public function __construct(private readonly VatCalculator $vatCalculator = new VatCalculator)
    {
    }

    public function findActive(string $tld): ?DomainPricing
    {
        return DomainPricing::query()->where('tld', $tld)->where('status', 'active')->first();
    }

    /**
     * @return array{registration_kobo: int, renewal_kobo: int, transfer_kobo: int, currency: string}|null
     */
    public function priceFor(string $tld): ?array
    {
        $pricing = $this->findActive($tld);

        // No active row, or an active row that isn't actually ready to price
        // (e.g. cost-plus markup with no FX rate synced yet) — never
        // fabricate a price; treat exactly like "no pricing configured".
        if (! $pricing || ! $pricing->hasUsableCostBasis()) {
            return null;
        }

        return [
            'registration_kobo' => $this->customerPrice($pricing, (int) $pricing->registration_price_kobo),
            'renewal_kobo' => $this->customerPrice($pricing, (int) $pricing->renewal_price_kobo),
            'transfer_kobo' => $this->customerPrice($pricing, (int) $pricing->transfer_price_kobo),
            'currency' => $pricing->currency,
        ];
    }

    public function customerPrice(DomainPricing $pricing, int $baseCostKobo): int
    {
        return match ($pricing->markup_type) {
            'fixed_customer_price', 'manual_price' => (int) ($pricing->fixed_customer_price_kobo ?? $baseCostKobo),
            'percentage_markup' => (int) round($baseCostKobo * (1 + ((float) $pricing->markup_percent / 100))),
            default => $baseCostKobo + (int) $pricing->markup_value_kobo, // cost_plus_markup (fixed amount)
        };
    }

    /**
     * Full subtotal → VAT → total breakdown for a given TLD + purchase type
     * ("registration"|"renewal"|"transfer"), reusing the existing
     * VatCalculator so a domain line item is computed identically to every
     * other invoice line.
     *
     * @return array{vat_rate: float, subtotal_kobo: int, discount_kobo: int, taxable_kobo: int, vat_amount_kobo: int, total_kobo: int}|null
     */
    public function breakdownFor(string $tld, string $type = 'registration'): ?array
    {
        $price = $this->priceFor($tld);
        $subtotalKobo = $price["{$type}_kobo"] ?? null;

        if ($subtotalKobo === null) {
            return null;
        }

        return $this->vatCalculator->calculate($subtotalKobo);
    }
}
