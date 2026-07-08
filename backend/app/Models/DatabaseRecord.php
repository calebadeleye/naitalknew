<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DatabaseRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'hosting_service_id',
        'ispconfig_database_id',
        'ispconfig_database_user_id',
        'database_name',
        'username',
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
