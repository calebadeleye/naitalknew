<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'staff_user_id',
        'client_id',
        'hosting_service_id',
        'invoice_id',
        'action',
        'reason',
        'before_state',
        'after_state',
        'reason_category',
        'notify_client',
        'effective_at',
        'supporting_reference',
        'source',
        'ispconfig_response',
        'error_details',
    ];

    protected function casts(): array
    {
        return [
            'before_state' => 'array',
            'after_state' => 'array',
            'notify_client' => 'boolean',
            'effective_at' => 'datetime',
            'ispconfig_response' => 'array',
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

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function staffUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_user_id');
    }
}
