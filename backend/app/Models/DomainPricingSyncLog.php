<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DomainPricingSyncLog extends Model
{
    protected $table = 'domain_pricing_sync_logs';

    protected $fillable = [
        'provider',
        'sync_type',
        'status',
        'started_at',
        'completed_at',
        'total_tlds_found',
        'total_tlds_created',
        'total_tlds_updated',
        'total_tlds_failed',
        'error_message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }
}
