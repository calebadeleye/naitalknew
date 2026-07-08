<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IspConfigClientMapping extends Model
{
    use HasFactory;

    protected $table = 'ispconfig_client_mappings';

    protected $fillable = [
        'client_id',
        'ispconfig_server_id',
        'ispconfig_client_id',
        'provisioned_at',
        'sync_status',
        'last_synced_at',
        'metadata_json',
    ];

    protected function casts(): array
    {
        return [
            'provisioned_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'metadata_json' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function serviceMappings(): HasMany
    {
        return $this->hasMany(IspConfigServiceMapping::class);
    }
}
