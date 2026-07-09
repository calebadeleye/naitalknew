<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class HostingService extends Model
{
    use HasFactory, SoftDeletes;

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
        'source',
        'plan_type',
        'imported_at',
        'last_synced_at',
        'created_from_ispconfig_at',
        'renewal_date_source',
        'renewal_status',
        'hosting_expires_at',
        'ssl_expires_at',
        'next_invoice_date',
        'migration_status',
        'upgrade_target_package_id',
        'upgrade_notified_at',
        'migrated_at',
        'service_type',
        'expired_at',
        'grace_period_ends_at',
        'deactivated_at',
        'scheduled_deletion_at',
        'deleted_from_ispconfig_at',
        'is_security_action',
        'ispconfig_active',
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
            'imported_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'created_from_ispconfig_at' => 'datetime',
            'hosting_expires_at' => 'date',
            'ssl_expires_at' => 'date',
            'next_invoice_date' => 'date',
            'upgrade_notified_at' => 'datetime',
            'migrated_at' => 'datetime',
            'expired_at' => 'datetime',
            'grace_period_ends_at' => 'date',
            'deactivated_at' => 'datetime',
            'scheduled_deletion_at' => 'date',
            'deleted_from_ispconfig_at' => 'datetime',
            'is_security_action' => 'boolean',
            'ispconfig_active' => 'boolean',
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

    public function upgradeTargetPackage(): BelongsTo
    {
        return $this->belongsTo(HostingPlan::class, 'upgrade_target_package_id');
    }

    public function provisioningLogs(): HasMany
    {
        return $this->hasMany(ProvisioningLog::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
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

    public function emailDomainRecords(): HasMany
    {
        return $this->hasMany(EmailDomainRecord::class);
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
