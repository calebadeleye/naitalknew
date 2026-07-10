<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Single-row global FX + default-markup config per provider. Use
 * DomainPricingSettings::forProvider('spaceship') to get-or-create it rather
 * than querying directly, so callers never have to handle "no row yet".
 */
class DomainPricingSettings extends Model
{
    protected $table = 'domain_pricing_settings';

    protected $fillable = [
        'provider',
        'base_currency',
        'target_currency',
        'exchange_rate',
        'safety_buffer_percent',
        'default_markup_type',
        'default_markup_value_kobo',
        'default_markup_percent',
        'auto_sync_enabled',
        'sync_frequency',
        'last_updated_by',
        'manual_balance_ngn_kobo',
        'manual_balance_checked_at',
        'low_balance_threshold_kobo',
    ];

    protected function casts(): array
    {
        return [
            'exchange_rate' => 'decimal:4',
            'safety_buffer_percent' => 'decimal:2',
            'default_markup_percent' => 'decimal:2',
            'auto_sync_enabled' => 'boolean',
            'manual_balance_checked_at' => 'datetime',
        ];
    }

    /**
     * Spaceship's API exposes no wallet/balance endpoint, so this compares
     * the admin's own manually-entered balance snapshot against the
     * configured threshold — never fabricated.
     */
    public function isBalanceLow(): bool
    {
        return $this->manual_balance_ngn_kobo !== null && $this->manual_balance_ngn_kobo < $this->low_balance_threshold_kobo;
    }

    /**
     * firstOrCreate() would otherwise INSERT an explicit NULL for every
     * unset fillable attribute (Eloquent always writes its full attribute
     * set), silently overriding the sensible column defaults declared in
     * the migration — so those defaults are repeated explicitly here.
     */
    public static function forProvider(string $provider = 'spaceship'): self
    {
        return static::query()->firstOrCreate(['provider' => $provider], [
            'base_currency' => 'USD',
            'target_currency' => 'NGN',
            'safety_buffer_percent' => 0,
            'default_markup_type' => 'cost_plus_markup',
            'default_markup_value_kobo' => 0,
            'auto_sync_enabled' => false,
            'sync_frequency' => 'manual',
            'low_balance_threshold_kobo' => 10_000_000,
        ]);
    }
}
