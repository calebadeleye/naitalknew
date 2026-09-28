<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A hidden, backend-only ISPConfig shell (SSH/SFTP) account that brokers the
 * client dashboard's File Manager — never exposed to the client. See the
 * migration for why this is separate from client-created SSH/SFTP accounts.
 */
class HostingFileManagerAccount extends Model
{
    protected $fillable = [
        'hosting_service_id',
        'ispconfig_shell_user_id',
        'username',
        'password',
        'status',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'encrypted',
            'last_synced_at' => 'datetime',
        ];
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }
}
