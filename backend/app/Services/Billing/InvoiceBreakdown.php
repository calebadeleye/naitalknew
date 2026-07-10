<?php

namespace App\Services\Billing;

use App\Models\Invoice;

/**
 * Turns an Invoice into the formatted financial breakdown shared by the
 * client invoice page, the PDF, every payment-related email, and the admin
 * invoice view — so "Subtotal / VAT / Total / Paid / Wallet / Outstanding"
 * never has to be recomputed (or its VAT % hardcoded) in more than one place.
 */
class InvoiceBreakdown
{
    /**
     * @return array<string, mixed>
     */
    public function build(Invoice $invoice): array
    {
        $vatRate = (float) $invoice->vat_rate;
        $balanceDueKobo = max($invoice->total_kobo - $invoice->amount_paid_kobo, 0);

        return [
            'vat_rate' => $vatRate,
            'vat_label' => 'VAT ('.$this->formatPercent($vatRate).')',
            'subtotal_kobo' => $invoice->subtotal_kobo,
            'subtotal' => Money::naira($invoice->subtotal_kobo),
            'discount_kobo' => $invoice->discount_kobo,
            'discount' => Money::naira($invoice->discount_kobo),
            'vat_amount_kobo' => $invoice->tax_kobo,
            'vat_amount' => Money::naira($invoice->tax_kobo),
            'total_kobo' => $invoice->total_kobo,
            'total' => Money::naira($invoice->total_kobo),
            'amount_paid_kobo' => $invoice->amount_paid_kobo,
            'amount_paid' => Money::naira($invoice->amount_paid_kobo),
            'wallet_amount_applied_kobo' => $invoice->wallet_amount_applied_kobo,
            'wallet_amount_applied' => Money::naira($invoice->wallet_amount_applied_kobo),
            'overpayment_amount_kobo' => $invoice->overpayment_amount_kobo,
            'overpayment_amount' => Money::naira($invoice->overpayment_amount_kobo),
            'underpayment_amount_kobo' => $invoice->underpayment_amount_kobo,
            'underpayment_amount' => Money::naira($invoice->underpayment_amount_kobo),
            'outstanding_amount_kobo' => $invoice->outstanding_amount_kobo,
            'outstanding_amount' => Money::naira($invoice->outstanding_amount_kobo),
            'balance_due_kobo' => $balanceDueKobo,
            'balance_due' => Money::naira($balanceDueKobo),
            'status' => $invoice->status,
            'reconciliation_status' => $invoice->reconciliation_status,
        ];
    }

    private function formatPercent(float $rate): string
    {
        $percent = rtrim(rtrim(number_format($rate * 100, 2, '.', ''), '0'), '.');

        return $percent.'%';
    }
}
