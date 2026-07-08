<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IspConfigServiceMapping extends Model
{
    use HasFactory;

    protected $table = 'ispconfig_service_mappings';

    protected $fillable = [
        'hosting_service_id',
        'ispconfig_server_id',
        'ispconfig_client_mapping_id',
        'ispconfig_website_id',
        // @deprecated in favor of MailboxRecord/DatabaseRecord/FtpAccountRecord — kept for backward compat, no longer written by new code.
        'ispconfig_mail_domain_id',
        'ispconfig_database_id',
        'ispconfig_ftp_user_id',
        'technical_status',
        'last_synced_at',
        'last_reconciled_at',
        'last_error',
        'metadata_json',
    ];

    protected function casts(): array
    {
        return [
            'last_synced_at' => 'datetime',
            'last_reconciled_at' => 'datetime',
            'metadata_json' => 'array',
        ];
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }

    public function clientMapping(): BelongsTo
    {
        return $this->belongsTo(IspConfigClientMapping::class, 'ispconfig_client_mapping_id');
    }
}
