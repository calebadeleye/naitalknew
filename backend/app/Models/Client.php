<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'client_code',
        'company_name',
        'website',
        'industry',
        'support_email',
        'company_size',
        'account_type',
        'client_status',
        'status',
        'billing_email',
        'billing_phone',
        'billing_address',
        'tax_id',
        'address',
        'city',
        'state',
        'country',
        'internal_notes',
        'last_activity_at',
        'suspended_at',
        'deactivated_at',
        'metadata',
        'communication_preferences',
    ];

    private const DEFAULT_COMMUNICATION_PREFERENCES = [
        'invoice_alerts' => true,
        'renewal_reminders' => true,
        'product_updates' => true,
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'last_activity_at' => 'datetime',
            'suspended_at' => 'datetime',
            'deactivated_at' => 'datetime',
            'communication_preferences' => 'array',
        ];
    }

    /**
     * A null column means "use the defaults" — every existing client row
     * predates this feature, so this keeps them all reading as fully
     * opted-in without a backfill migration.
     */
    public function communicationPreferences(): array
    {
        return array_merge(self::DEFAULT_COMMUNICATION_PREFERENCES, $this->communication_preferences ?? []);
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

    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class);
    }

    public function savedPaymentMethods(): HasMany
    {
        return $this->hasMany(SavedPaymentMethod::class);
    }

    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class);
    }

    public function domainOrders(): HasMany
    {
        return $this->hasMany(DomainOrder::class);
    }

    public function domainTransfers(): HasMany
    {
        return $this->hasMany(DomainTransfer::class);
    }

    public function domainContact(): HasOne
    {
        return $this->hasOne(DomainContact::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ClientActivityLog::class);
    }
}
