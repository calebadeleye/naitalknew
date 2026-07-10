<?php

namespace App\Http\Resources;

use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Controls which fields the generic admin table (AdminRecordsSection, which
 * renders the first ~7 keys of each row as columns) shows first for
 * invoices — the reconciliation breakdown from spec §13, not raw DB column
 * order. Every field is still present in the payload for any deeper view.
 */
class AdminInvoiceResource extends JsonResource
{
    public function toArray($request): array
    {
        $breakdown = (new InvoiceBreakdown)->build($this->resource);

        return [
            'invoice_number' => $this->invoice_number,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->user?->name ?: $this->client->company_name,
                'email' => $this->client->user?->email ?: $this->client->billing_email,
            ] : null,
            'status' => $this->status,
            'reconciliation_status' => $this->reconciliation_status,
            'total' => $breakdown['total'],
            'amount_paid' => $breakdown['amount_paid'],
            'outstanding_amount' => $breakdown['outstanding_amount'],
            'subtotal' => $breakdown['subtotal'],
            'vat_rate' => $breakdown['vat_rate'],
            'vat_amount' => $breakdown['vat_amount'],
            'wallet_amount_applied' => $breakdown['wallet_amount_applied'],
            'overpayment_amount' => $breakdown['overpayment_amount'],
            'underpayment_amount' => $breakdown['underpayment_amount'],
            'provisioning_eligible' => $this->status === 'paid',
            'issued_at' => $this->issued_at?->toDateString(),
            'due_at' => $this->due_at?->toDateString(),
            'paid_at' => $this->paid_at?->toDateString(),
            'id' => $this->id,
            'order_id' => $this->order_id,
        ];
    }
}
