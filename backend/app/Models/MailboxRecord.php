<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class MailboxRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'hosting_service_id',
        'ispconfig_mailbox_id',
        'email_address',
        'display_name',
        'quota_mb',
        'status',
        'source',
        'imported_at',
        'last_synced_at',
        'metadata_json',
    ];

    protected function casts(): array
    {
        return [
            'imported_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'metadata_json' => 'array',
        ];
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }
}
