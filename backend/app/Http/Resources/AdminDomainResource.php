<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class AdminDomainResource extends JsonResource
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
            'source' => $this->source,
            'status' => $this->status,
            'registration_status' => $this->registration_status,
            'expires_at' => $this->expires_at?->toDateString(),
            'linked_hosting_service' => $this->linkedHostingService ? [
                'id' => $this->linkedHostingService->id,
                'service_number' => $this->linkedHostingService->service_number,
                'status' => $this->linkedHostingService->status,
            ] : null,
            'tld' => $this->tld,
            'provider' => $this->provider,
            'provider_domain_id' => $this->provider_domain_id,
            'transfer_status' => $this->transfer_status,
            'auto_renew' => $this->auto_renew,
            'registered_at' => $this->registered_at?->toDateString(),
            'id' => $this->id,
        ];
    }
}
