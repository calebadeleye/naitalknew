<?php

namespace App\Http\Resources;

use App\Services\Billing\Money;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminPaymentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'reference' => $this->reference,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->user?->name ?: $this->client->company_name,
                'email' => $this->client->user?->email ?: $this->client->billing_email,
            ] : null,
            'gateway' => $this->gateway,
            'purpose' => $this->purpose,
            'status' => $this->status,
            'amount' => Money::naira($this->amount_kobo),
            'reconciled_at' => $this->reconciled_at?->toIso8601String(),
            'id' => $this->id,
            'invoice' => $this->invoice ? [
                'id' => $this->invoice->id,
                'invoice_number' => $this->invoice->invoice_number,
                'status' => $this->invoice->status,
            ] : null,
            'amount_kobo' => $this->amount_kobo,
            'currency' => $this->currency,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'receipt_path' => $this->receipt_path,
        ];
    }
}
