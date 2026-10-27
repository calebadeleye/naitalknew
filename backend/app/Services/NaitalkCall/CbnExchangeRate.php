<?php

namespace App\Services\NaitalkCall;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * The Central Bank of Nigeria's official USD→NGN rate (the US DOLLAR central
 * rate from CBN's published table), kept in app settings so pages never wait
 * on CBN. Refreshed by naitalk-call:fetch-cbn-rate.
 */
class CbnExchangeRate
{
    public const SETTING = 'naitalk_call_usd_ngn';

    /** ['rate' => float, 'date' => 'Y-m-d', 'source' => 'CBN', 'fetched_at' => ISO] or null. */
    public function current(): ?array
    {
        $stored = AppSetting::get(self::SETTING);

        return is_array($stored) && isset($stored['rate']) ? $stored : null;
    }

    /** Fetches the newest published rate and stores it. */
    public function refresh(): array
    {
        $response = Http::timeout(90)->withHeaders(['User-Agent' => 'Mozilla/5.0 (NAI TALK rate check)', 'Accept' => 'application/json'])
            ->get(config('naitalk_call.cbn_rates_url'));
        if (! $response->successful()) {
            throw new RuntimeException("CBN rates request failed: HTTP {$response->status()}");
        }

        $latest = collect($response->json() ?? [])
            ->filter(fn ($row) => is_array($row) && strtoupper(trim((string) ($row['currency'] ?? ''))) === 'US DOLLAR')
            ->sortByDesc(fn ($row) => (string) ($row['ratedate'] ?? ''))
            ->first();
        $rate = (float) ($latest['centralrate'] ?? 0);
        // A rate far outside any plausible range means the table changed shape.
        if (! $latest || $rate < 100 || $rate > 100_000) {
            throw new RuntimeException('CBN rates had no usable US DOLLAR central rate.');
        }

        $value = ['rate' => round($rate, 4), 'date' => (string) $latest['ratedate'], 'source' => 'CBN', 'fetched_at' => now()->toIso8601String()];
        AppSetting::put(self::SETTING, $value);

        return $value;
    }
}
