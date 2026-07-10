<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Domain extends Model
{
    protected $fillable = [
        'client_id',
        'domain_name',
        'tld',
        'source',
        'provider',
        'provider_domain_id',
        'status',
        'registration_status',
        'transfer_status',
        'registered_at',
        'expires_at',
        'auto_renew',
        'linked_hosting_service_id',
    ];

    protected function casts(): array
    {
        return [
            'registered_at' => 'date',
            'expires_at' => 'date',
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
}
