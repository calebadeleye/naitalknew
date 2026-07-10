<?php

namespace App\Http\Resources;

use App\Services\Billing\Money;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminDomainOrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'domain_name' => $this->domain_name,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->user?->name ?: $this->client->company_name,
                'email' => $this->client->user?->email ?: $this->client->billing_email,
            ] : null,
            'order_type' => $this->order_type,
            'status' => $this->status,
            'total_amount' => Money::naira($this->total_amount_kobo),
            'error_message' => $this->error_message,
            'invoice' => $this->invoice ? [
                'invoice_number' => $this->invoice->invoice_number,
                'status' => $this->invoice->status,
            ] : null,
            'provider' => $this->provider,
            'provider_reference' => $this->provider_reference,
            'price_kobo' => $this->price_kobo,
            'vat_amount_kobo' => $this->vat_amount_kobo,
            'total_amount_kobo' => $this->total_amount_kobo,
            'id' => $this->id,
            'domain_id' => $this->domain_id,
            'hosting_service_id' => $this->hosting_service_id,
        ];
    }
}
