<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HostingUsageSnapshot extends Model
{
    protected $fillable = [
        'hosting_service_id',
        'disk_used_mb',
        'disk_quota_mb',
        'bandwidth_used_mb',
        'bandwidth_quota_mb',
        'email_accounts_used',
        'email_accounts_limit',
        'databases_used',
        'databases_limit',
        'ftp_accounts_used',
        'ftp_accounts_limit',
        'ssh_sftp_enabled',
        'captured_at',
        'source',
    ];

    protected function casts(): array
    {
        return [
            'ssh_sftp_enabled' => 'boolean',
            'captured_at' => 'datetime',
        ];
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }
}
