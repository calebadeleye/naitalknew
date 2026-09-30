<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SoftwareInstallation extends Model
{
    use SoftDeletes;

    protected $table = 'software_installations';

    protected $fillable = [
        'hosting_service_id',
        'catalog_slug',
        'status',
        'progress_step',
        'subdomain',
        'install_path',
        'node_port',
        'redis_db_index',
        'redis_cache_db_index',
        'redis_queue_db_index',
        'admin_email',
        'admin_password_shown_once',
        'error_message',
        'metadata_json',
        'installed_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata_json' => 'array',
            'installed_at' => 'datetime',
        ];
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }

    /**
     * The one-time admin password is readable exactly once: the first time a
     * client fetches this record after it reaches `active`, the controller
     * reads this field and immediately clears it (mirrors how the admin
     * FTP-account endpoint returns a plaintext password once and never
     * stores it again).
     */
    public function consumeOneTimePassword(): ?string
    {
        $password = $this->admin_password_shown_once;

        if ($password !== null) {
            $this->forceFill(['admin_password_shown_once' => null])->save();
        }

        return $password;
    }
}
