<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only record of the exact cost/FX/markup/tax/profit figures at the
 * moment of a registration, transfer, or renewal. Never updated after
 * creation — historical transactions must never be recalculated using a
 * later exchange rate or later TLD pricing.
 */
class DomainFinancialSnapshot extends Model
{
    protected $fillable = [
        'domain_id',
        'domain_order_id',
        'event_type',
        'provider',
        'provider_cost_minor',
        'provider_currency',
        'exchange_rate_to_ngn',
        'converted_cost_kobo',
        'markup_type',
        'markup_amount_kobo',
        'tax_kobo',
        'customer_amount_kobo',
        'payment_gateway',
        'payment_gateway_fee_kobo',
        'gross_profit_estimate_kobo',
        'transaction_reference',
        'invoice_id',
    ];

    protected function casts(): array
    {
        return [
            'exchange_rate_to_ngn' => 'decimal:4',
        ];
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    public function domainOrder(): BelongsTo
    {
        return $this->belongsTo(DomainOrder::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
