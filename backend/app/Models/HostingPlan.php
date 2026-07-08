<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HostingPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'short_description',
        'monthly_price_kobo',
        'annual_price_kobo',
        'setup_fee_kobo',
        'storage_allocation',
        'bandwidth_policy',
        'websites',
        'databases',
        'email_accounts',
        'backup_frequency',
        'support_tier',
        'migration_included',
        'is_featured',
        'is_active',
        'sort_order',
        'internal_notes',
        'configuration_json',
    ];

    protected function casts(): array
    {
        return [
            'migration_included' => 'boolean',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
            'configuration_json' => 'array',
        ];
    }

    public function hostingServices(): HasMany
    {
        return $this->hasMany(HostingService::class);
    }

    /**
     * Structured provisioning limits/capabilities for this plan, with safe
     * defaults so provisioning code never has to null-check every key.
     *
     * @return array<string, mixed>
     */
    public function configuration(): array
    {
        return array_merge([
            'disk_quota_mb' => 0,
            'bandwidth_quota_mb' => 0,
            'max_email_accounts' => 0,
            'max_databases' => 0,
            'max_ftp_accounts' => 0,
            'ssh_access_enabled' => false,
            'sftp_access_enabled' => false,
            'ssl_enabled' => true,
            'backup_enabled' => false,
            'php_version' => '8.2',
            'max_subdomains' => 0,
            'max_aliases' => 0,
            'default_server_id' => 1,
        ], $this->configuration_json ?? []);
    }
}
