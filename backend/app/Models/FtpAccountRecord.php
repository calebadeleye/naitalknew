<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FtpAccountRecord extends Model
{
    use SoftDeletes;

    protected $table = 'ftp_account_records';

    protected $fillable = [
        'hosting_service_id',
        'ispconfig_ftp_user_id',
        'username',
        'access_type',
        'status',
        'last_synced_at',
        'metadata_json',
    ];

    protected function casts(): array
    {
        return [
            'last_synced_at' => 'datetime',
            'metadata_json' => 'array',
        ];
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }
}
