<?php

namespace App\Services\NaitalkCall;

/**
 * Naitalk Call plan prices in dollars plus their Naira equivalent at the
 * CBN official rate (see CbnExchangeRate).
 */
class NaitalkCallPricing
{
    public function __construct(private readonly CbnExchangeRate $cbn) {}

    /** Every plan, in order, for the pricing page and the admin. */
    public function plans(): array
    {
        $rate = $this->cbn->current();

        return collect(config('naitalk_call.plans'))->map(fn (array $plan, string $id) => $this->plan($id, null, $rate))->values()->all();
    }

    /** The official rate the Naira prices use, or null before the first fetch. */
    public function exchangeRate(): ?array
    {
        return $this->cbn->current();
    }

    /** One plan; [$usdCents] overrides its price (a business on a custom price). */
    public function plan(string $plan, ?int $usdCents = null, ?array $rate = null): array
    {
        $definition = config("naitalk_call.plans.$plan") ?? config('naitalk_call.plans.'.config('naitalk_call.default_plan'));
        $usdCents ??= (int) $definition['monthly_usd_cents'];
        $rate ??= $this->cbn->current();
        $perDollar = $rate['rate'] ?? null;

        return [
            'id' => $plan,
            'name' => $definition['name'],
            'tagline' => $definition['tagline'] ?? null,
            'included_minutes' => (int) ($definition['included_minutes'] ?? 0),
            'features' => $definition['features'] ?? [],
            'monthly_usd_cents' => $usdCents,
            'monthly_usd' => $usdCents === 0 ? 'Free' : '$'.number_format($usdCents / 100, $usdCents % 100 === 0 ? 0 : 2),
            // Whole naira at the official rate; null until the first fetch, or for free plans.
            'monthly_ngn_kobo' => $perDollar === null || $usdCents === 0 ? null : (int) round($usdCents * $perDollar / 100) * 100,
        ];
    }
}
