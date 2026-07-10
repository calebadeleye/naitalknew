<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'order_number',
        'status',
        'billing_cycle',
        'subtotal_kobo',
        'discount_kobo',
        'tax_kobo',
        'vat_rate',
        'total_kobo',
        'accepted_terms_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'accepted_terms_at' => 'datetime',
            'metadata' => 'array',
            'vat_rate' => 'float',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function invoice(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function hostingServices(): HasMany
    {
        return $this->hasMany(HostingService::class);
    }

    public function domainOrders(): HasMany
    {
        return $this->hasMany(DomainOrder::class);
    }
}
