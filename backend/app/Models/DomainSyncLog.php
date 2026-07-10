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
        'response_summary',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'response_summary' => 'array',
        ];
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }
}
