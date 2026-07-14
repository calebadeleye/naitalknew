<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class AdminDomainResource extends JsonResource
{
    /**
     * Key order matters here beyond readability: the generic admin records
     * table (AdminRecordsSection in src/App.tsx) derives its visible columns
     * from the first 7 keys of the first row. These 7 are deliberately
     * curated as the most useful at-a-glance fields for the plain domains
     * list — everything else is still present in the payload for the
     * detail view/row actions, just not a default column.
     */
    public function toArray($request): array
    {
        return [
            'domain_name' => $this->domain_name,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->user?->name ?: $this->client->company_name,
                'email' => $this->client->user?->email ?: $this->client->billing_email,
            ] : null,
            'provider' => $this->provider,
            'ownership_assignment_status' => $this->ownership_assignment_status,
            'status' => $this->status,
            'expires_at' => $this->expires_at?->toDateString(),
            'payment_status' => $this->payment_status,

            'source' => $this->source,
            'registration_source' => $this->registration_source,
            'registration_status' => $this->registration_status,
            'provider_status' => $this->provider_status,
            'registrar_operation_status' => $this->registrar_operation_status,
            'dns_provider' => $this->dns_provider,
            'linked_hosting_service' => $this->linkedHostingService ? [
                'id' => $this->linkedHostingService->id,
                'service_number' => $this->linkedHostingService->service_number,
                'status' => $this->linkedHostingService->status,
            ] : null,
            'tld' => $this->tld,
            'provider_domain_id' => $this->provider_domain_id,
            'provider_order_id' => $this->provider_order_id,
            'provider_cost_minor' => $this->provider_cost_minor,
            'provider_currency' => $this->provider_currency,
            'customer_renewal_price_kobo' => $this->customer_renewal_price_kobo,
            'next_invoice_date' => $this->next_invoice_date?->toDateString(),
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'transfer_status' => $this->transfer_status,
            'auto_renew' => $this->auto_renew,
            'registered_at' => $this->registered_at?->toDateString(),
            'assigned_by' => $this->assignedBy ? [
                'id' => $this->assignedBy->id,
                'name' => $this->assignedBy->name,
            ] : null,
            'assigned_at' => $this->assigned_at?->toIso8601String(),
            'assignment_note' => $this->assignment_note,
            'id' => $this->id,
        ];
    }
}
