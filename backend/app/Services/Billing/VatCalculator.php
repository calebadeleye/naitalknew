<?php

namespace App\Services\Billing;

use App\Models\AppSetting;

/**
 * Single source of truth for VAT math so every order/invoice/renewal path
 * (checkout, legacy renewals, standard renewals, reconciliation's integrity
 * check) agrees on the same numbers.
 */
class VatCalculator
{
    public const SETTING_KEY = 'vat_enabled';

    /**
     * VAT is charged unless an admin has switched it off (Admin → Pricing).
     * Documents already issued keep the rate stored on them either way.
     */
    public static function isEnabled(): bool
    {
        return (bool) AppSetting::get(self::SETTING_KEY, true);
    }

    /** The rate new orders/invoices use right now: the configured rate, or 0 when VAT is off. */
    public static function currentRate(): float
    {
        return self::isEnabled() ? (float) config('billing.vat_rate') : 0.0;
    }

    /**
     * @return array{vat_rate: float, subtotal_kobo: int, discount_kobo: int, taxable_kobo: int, vat_amount_kobo: int, total_kobo: int}
     */
    public function calculate(int $subtotalKobo, int $discountKobo = 0, ?float $vatRate = null): array
    {
        $vatRate = $vatRate ?? self::currentRate();
        $taxableKobo = max($subtotalKobo - $discountKobo, 0);
        $vatAmountKobo = (int) round($taxableKobo * $vatRate);
        $totalKobo = $taxableKobo + $vatAmountKobo;

        return [
            'vat_rate' => $vatRate,
            'subtotal_kobo' => $subtotalKobo,
            'discount_kobo' => $discountKobo,
            'taxable_kobo' => $taxableKobo,
            'vat_amount_kobo' => $vatAmountKobo,
            'total_kobo' => $totalKobo,
        ];
    }

    /**
     * Recomputes the expected total for an already-created order/invoice and
     * reports whether the stored figures still agree — used as a tamper /
     * drift guard before reconciling a payment.
     */
    public function matchesStoredTotals(int $subtotalKobo, int $discountKobo, float $vatRate, int $storedTaxKobo, int $storedTotalKobo): bool
    {
        $expected = $this->calculate($subtotalKobo, $discountKobo, $vatRate);

        return $expected['vat_amount_kobo'] === $storedTaxKobo && $expected['total_kobo'] === $storedTotalKobo;
    }
}
