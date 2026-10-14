<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    use HasFactory;

    public const STATUSES = ['open', 'answered', 'closed'];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    public const CATEGORIES = ['technical', 'billing', 'domain', 'email', 'website', 'other'];

    protected $fillable = [
        'client_id',
        'user_id',
        'hosting_service_id',
        'ticket_number',
        'subject',
        'category',
        'status',
        'priority',
        'latest_message',
        'last_reply_by',
        'last_reply_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'last_reply_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'ticket_number';
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class)->oldest('id');
    }
}
