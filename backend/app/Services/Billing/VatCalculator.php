<?php

namespace App\Services\Billing;

/**
 * Single source of truth for VAT math so every order/invoice/renewal path
 * (checkout, legacy renewals, standard renewals, reconciliation's integrity
 * check) agrees on the same numbers.
 */
class VatCalculator
{
    /**
     * @return array{vat_rate: float, subtotal_kobo: int, discount_kobo: int, taxable_kobo: int, vat_amount_kobo: int, total_kobo: int}
     */
    public function calculate(int $subtotalKobo, int $discountKobo = 0, ?float $vatRate = null): array
    {
        $vatRate = $vatRate ?? (float) config('billing.vat_rate');
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
