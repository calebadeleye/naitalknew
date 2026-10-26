<?php

namespace App\Services\NaitalkCall;

use App\Models\DomainPricingSettings;

/**
 * The Naitalk Call plan price in dollars plus its Naira equivalent, using the
 * USD→NGN rate the admin keeps in Domain Pricing settings.
 */
class NaitalkCallPricing
{
    public function plan(string $plan = 'business', ?int $usdCents = null): array
    {
        $definition = config("naitalk_call.plans.$plan") ?? config('naitalk_call.plans.business');
        $usdCents ??= (int) $definition['monthly_usd_cents'];

        // Read only: a public page must not create the settings row.
        $settings = DomainPricingSettings::query()->where('provider', 'spaceship')->first(['exchange_rate', 'updated_at']);
        $rate = $settings?->exchange_rate === null ? null : (float) $settings->exchange_rate;

        return [
            'plan' => $plan,
            'name' => $definition['name'],
            'monthly_usd_cents' => $usdCents,
            'monthly_usd' => '$'.number_format($usdCents / 100, $usdCents % 100 === 0 ? 0 : 2),
            'exchange_rate' => $rate,
            'exchange_rate_updated_at' => $settings?->updated_at?->toIso8601String(),
            // Whole naira; null until the admin has set a rate.
            'monthly_ngn_kobo' => $rate === null ? null : (int) round($usdCents * $rate / 100) * 100,
        ];
    }
}
