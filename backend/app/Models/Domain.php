<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Two existing columns double as the provider-independent registrar
 * concepts introduced alongside Cloudflare Registrar support:
 *
 * - `provider` IS "registrar_provider" (spaceship|cloudflare|external|manual).
 * - `status` IS "local_status" (NAITALK's own lifecycle, unrelated to
 *   whatever the registrar itself reports — see `provider_status`).
 *
 * `registration_status` remains Spaceship's manual-registration payment/
 * order-workflow state machine — distinct from `provider_status`, which is
 * the raw/normalized state as reported by whichever registrar this domain
 * belongs to. `source` remains the legacy source label; `registration_source`
 * is its provider-agnostic successor, populated going forward.
 */
class Domain extends Model
{
    protected $fillable = [
        'client_id',
        'domain_name',
        'tld',
        'source',
        'registration_source',
        'provider',
        'provider_domain_id',
        'provider_order_id',
        'provider_cost_minor',
        'provider_currency',
        'customer_renewal_price_kobo',
        'status',
        'registration_status',
        'provider_status',
        'transfer_status',
        'registered_at',
        'expires_at',
        'next_invoice_date',
        'last_synced_at',
        'provider_metadata',
        'ownership_assignment_status',
        'payment_status',
        'registrar_operation_status',
        'dns_provider',
        'assigned_by',
        'assigned_at',
        'assignment_note',
        'auto_renew',
        'linked_hosting_service_id',
    ];

    protected function casts(): array
    {
        return [
            'registered_at' => 'date',
            'expires_at' => 'date',
            'next_invoice_date' => 'date',
            'last_synced_at' => 'datetime',
            'assigned_at' => 'datetime',
            'provider_metadata' => 'array',
            'auto_renew' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function linkedHostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class, 'linked_hosting_service_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(DomainOrder::class);
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(DomainTransfer::class);
    }

    public function syncLogs(): HasMany
    {
        return $this->hasMany(DomainSyncLog::class);
    }

    public function financialSnapshots(): HasMany
    {
        return $this->hasMany(DomainFinancialSnapshot::class);
    }
}
