<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DomainSyncLog extends Model
{
    protected $fillable = [
        'domain_id',
        'provider',
        'action',
        'status',
        'request_reference',
        'response_code',
        'response_summary',
        'changes',
        'error_message',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'response_summary' => 'array',
            'changes' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }
}
