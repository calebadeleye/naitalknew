<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'hosting_service_id',
        'domain',
        'channel',
        'template',
        'subject',
        'recipient',
        'status',
        'failure_reason',
        'payload',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }
}
