<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavedPaymentMethod extends Model
{
    protected $fillable = [
        'client_id',
        'payment_provider',
        'provider_customer_id',
        'provider_authorization_code',
        'card_brand',
        'last4',
        'exp_month',
        'exp_year',
        'is_active',
        'is_default',
        'use_for_auto_renewal',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_default' => 'boolean',
            'use_for_auto_renewal' => 'boolean',
            'exp_month' => 'integer',
            'exp_year' => 'integer',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
