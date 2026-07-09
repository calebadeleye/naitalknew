<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'client_code',
        'company_name',
        'account_type',
        'client_status',
        'status',
        'billing_email',
        'billing_phone',
        'billing_address',
        'tax_id',
        'address',
        'city',
        'country',
        'internal_notes',
        'last_activity_at',
        'suspended_at',
        'deactivated_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'last_activity_at' => 'datetime',
            'suspended_at' => 'datetime',
            'deactivated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function hostingServices(): HasMany
    {
        return $this->hasMany(HostingService::class);
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function ispConfigClientMappings(): HasMany
    {
        return $this->hasMany(IspConfigClientMapping::class);
    }

    public function provisioningLogs(): HasMany
    {
        return $this->hasMany(ProvisioningLog::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function notificationLogs(): HasMany
    {
        return $this->hasMany(NotificationLog::class);
    }
}
