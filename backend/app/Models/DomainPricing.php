<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DomainPricing extends Model
{
    protected $table = 'domain_pricing';

    protected $fillable = [
        'tld',
        'provider',
        'currency',
        'provider_currency',
        'provider_registration_price_minor',
        'provider_renewal_price_minor',
        'provider_transfer_price_minor',
        'exchange_rate_to_ngn',
        'safety_buffer_percent',
        'registration_price_kobo',
        'renewal_price_kobo',
        'transfer_price_kobo',
        'markup_type',
        'markup_value_kobo',
        'markup_percent',
        'fixed_customer_price_kobo',
        'status',
        'last_synced_at',
        'last_sync_status',
        'last_sync_error',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'last_synced_at' => 'datetime',
            'exchange_rate_to_ngn' => 'decimal:4',
            'safety_buffer_percent' => 'decimal:2',
            'markup_percent' => 'decimal:2',
            'metadata' => 'array',
        ];
    }

    /**
     * Whether this TLD is ready to be recalculated/sold: needs a converted
     * NGN cost basis (either from a completed FX conversion, or a manual
     * fixed_customer_price that never needs one).
     */
    public function hasUsableCostBasis(): bool
    {
        if ($this->markup_type === 'fixed_customer_price' || $this->markup_type === 'manual_price') {
            return $this->fixed_customer_price_kobo !== null;
        }

        return $this->exchange_rate_to_ngn !== null;
    }
}
