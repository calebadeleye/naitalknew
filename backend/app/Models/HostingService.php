<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HostingService extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'hosting_plan_id',
        'order_id',
        'service_number',
        'display_name',
        'primary_domain',
        'status',
        'billing_cycle',
        'amount_kobo',
        'starts_at',
        'next_due_date',
        'renews_at',
        'expires_at',
        'suspended_at',
        'auto_renew_enabled',
        'provisioning_status',
        'ispconfig_server_id',
        'ispconfig_site_id',
        'provisioning_override_approved_at',
        'provisioning_override_approved_by',
        'provisioning_payload',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'next_due_date' => 'date',
            'renews_at' => 'date',
            'expires_at' => 'date',
            'suspended_at' => 'date',
            'auto_renew_enabled' => 'boolean',
            'provisioning_override_approved_at' => 'datetime',
            'provisioning_payload' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function hostingPlan(): BelongsTo
    {
        return $this->belongsTo(HostingPlan::class);
    }

    public function provisioningLogs(): HasMany
    {
        return $this->hasMany(ProvisioningLog::class);
    }

    public function ispConfigServiceMappings(): HasMany
    {
        return $this->hasMany(IspConfigServiceMapping::class);
    }

    public function usageSnapshots(): HasMany
    {
        return $this->hasMany(HostingUsageSnapshot::class);
    }

    public function mailboxRecords(): HasMany
    {
        return $this->hasMany(MailboxRecord::class);
    }

    public function databaseRecords(): HasMany
    {
        return $this->hasMany(DatabaseRecord::class);
    }

    public function ftpAccountRecords(): HasMany
    {
        return $this->hasMany(FtpAccountRecord::class);
    }

    public function latestUsageSnapshot(): ?HostingUsageSnapshot
    {
        return $this->usageSnapshots()->latest('captured_at')->first();
    }
}
