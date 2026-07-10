<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DomainPricingSettings;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The one place the admin sets the USD→NGN exchange rate, safety buffer,
 * and default markup used for every newly-synced TLD. Per-TLD markup stays
 * editable individually via DomainPricingController — this is only the
 * global defaults + FX rate.
 */
class DomainPricingSettingsController extends Controller
{
    public function show()
    {
        return response()->json($this->serialize(DomainPricingSettings::forProvider('spaceship')));
    }

    private const AUDITED_FIELDS = [
        'exchange_rate', 'safety_buffer_percent', 'default_markup_type', 'default_markup_value_kobo',
        'default_markup_percent', 'auto_sync_enabled', 'sync_frequency',
    ];

    public function update(Request $request)
    {
        $settings = DomainPricingSettings::forProvider('spaceship');
        $before = $settings->only(self::AUDITED_FIELDS);

        $payload = $request->validate([
            'base_currency' => ['required', 'string', 'max:3'],
            'target_currency' => ['required', 'string', 'max:3'],
            'exchange_rate' => ['required', 'numeric', 'min:0.0001'],
            'safety_buffer_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'default_markup_type' => ['required', Rule::in(['cost_plus_markup', 'percentage_markup', 'fixed_customer_price'])],
            'default_markup_value_kobo' => ['nullable', 'integer', 'min:0'],
            'default_markup_percent' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'auto_sync_enabled' => ['boolean'],
            'sync_frequency' => ['required', Rule::in(['manual', 'weekly', 'monthly'])],
        ]);

        $settings->update([...$payload, 'last_updated_by' => $request->user()?->email ?? $request->user()?->name]);

        AuditLog::query()->create([
            'staff_user_id' => $request->user()?->id,
            'action' => 'domain_pricing_settings_updated',
            'reason' => 'Admin updated domain pricing FX rate / default markup settings.',
            'before_state' => $before,
            'after_state' => $settings->refresh()->only(self::AUDITED_FIELDS),
        ]);

        return response()->json($this->serialize($settings));
    }

    /**
     * Spaceship has no wallet/balance API (confirmed against their docs) —
     * the admin records their own balance snapshot here instead of it being
     * faked. Not an audited pricing change, so it's a separate endpoint.
     */
    public function updateBalance(Request $request)
    {
        $settings = DomainPricingSettings::forProvider('spaceship');

        $payload = $request->validate([
            'manual_balance_ngn_kobo' => ['required', 'integer', 'min:0'],
            'low_balance_threshold_kobo' => ['nullable', 'integer', 'min:0'],
        ]);

        $settings->update([
            'manual_balance_ngn_kobo' => $payload['manual_balance_ngn_kobo'],
            'low_balance_threshold_kobo' => $payload['low_balance_threshold_kobo'] ?? $settings->low_balance_threshold_kobo,
            'manual_balance_checked_at' => now(),
        ]);

        return response()->json($this->serialize($settings->refresh()));
    }

    private function serialize(DomainPricingSettings $settings): array
    {
        return [
            'provider' => $settings->provider,
            'base_currency' => $settings->base_currency,
            'target_currency' => $settings->target_currency,
            'exchange_rate' => $settings->exchange_rate === null ? null : (float) $settings->exchange_rate,
            'safety_buffer_percent' => (float) $settings->safety_buffer_percent,
            'default_markup_type' => $settings->default_markup_type,
            'default_markup_value_kobo' => $settings->default_markup_value_kobo,
            'default_markup_percent' => $settings->default_markup_percent === null ? null : (float) $settings->default_markup_percent,
            'auto_sync_enabled' => $settings->auto_sync_enabled,
            'sync_frequency' => $settings->sync_frequency,
            'last_updated_by' => $settings->last_updated_by,
            'updated_at' => $settings->updated_at?->toIso8601String(),
            // Manual balance tracking — Spaceship has no balance API, so
            // this is never fetched live, only what the admin last entered.
            'manual_balance_ngn_kobo' => $settings->manual_balance_ngn_kobo,
            'manual_balance_checked_at' => $settings->manual_balance_checked_at?->toIso8601String(),
            'low_balance_threshold_kobo' => $settings->low_balance_threshold_kobo,
            'is_balance_low' => $settings->isBalanceLow(),
        ];
    }
}
