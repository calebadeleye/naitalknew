<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Never exposes epp_code_encrypted (nor a decrypted EPP code) — admins can
 * see transfer status and failure reasons, never the auth code itself.
 */
class AdminDomainTransferResource extends JsonResource
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
            'transfer_status' => $this->transfer_status,
            'initiated_at' => $this->initiated_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'failure_reason' => $this->failure_reason,
            'invoice' => $this->invoice ? [
                'invoice_number' => $this->invoice->invoice_number,
                'status' => $this->invoice->status,
            ] : null,
            'provider' => $this->provider,
            'provider_transfer_id' => $this->provider_transfer_id,
            'id' => $this->id,
            'domain_id' => $this->domain_id,
        ];
    }
}
