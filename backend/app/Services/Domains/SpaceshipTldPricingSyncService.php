<?php

namespace App\Services\Domains;

use App\Models\DomainPricing;
use App\Models\DomainPricingSettings;
use App\Models\DomainPricingSyncLog;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Pulls TLD prices from Spaceship and upserts domain_pricing by (provider,
 * tld) — never duplicating a row, never overwriting an admin's existing
 * markup, and never wiping out prices on failure. The only thing this
 * service ever recalculates from provider data is the NGN cost basis;
 * markup stays under NAI TALK's control (see markup preservation below).
 */
class SpaceshipTldPricingSyncService
{
    public function __construct(
        private readonly SpaceshipClient $client,
        private readonly DomainPricingService $pricing = new DomainPricingService,
    ) {
    }

    public function sync(string $syncType = 'manual'): DomainPricingSyncLog
    {
        $log = DomainPricingSyncLog::query()->create([
            'provider' => 'spaceship',
            'sync_type' => $syncType,
            'status' => 'running',
            'started_at' => now(),
        ]);

        $settings = DomainPricingSettings::forProvider('spaceship');

        if (! $settings->exchange_rate) {
            $log->forceFill([
                'status' => 'failed',
                'completed_at' => now(),
                'error_message' => 'No exchange rate configured in domain pricing settings — existing prices left untouched.',
            ])->save();

            return $log->fresh();
        }

        $found = 0;
        $created = 0;
        $updated = 0;
        $failed = 0;

        try {
            $items = $this->client->listTldPricing();
            $found = count($items);

            foreach ($items as $item) {
                try {
                    if ($this->upsertTld($item, $settings)) {
                        $created++;
                    } else {
                        $updated++;
                    }
                } catch (Throwable $exception) {
                    $failed++;
                    // Never log the raw $item blindly — it's provider pricing data
                    // only, but keep the habit of never logging exception internals
                    // that could carry request/response bodies with secrets.
                    Log::warning('Domain TLD price sync failed for one TLD.', [
                        'tld' => $item['tld'] ?? null,
                        'reason' => $exception->getMessage(),
                    ]);
                }
            }

            $log->forceFill([
                'status' => match (true) {
                    $found === 0 => 'failed',
                    $failed === 0 => 'success',
                    $failed === $found => 'failed',
                    default => 'partial',
                },
                'completed_at' => now(),
                'total_tlds_found' => $found,
                'total_tlds_created' => $created,
                'total_tlds_updated' => $updated,
                'total_tlds_failed' => $failed,
                'error_message' => $found === 0 ? 'Spaceship returned no TLD pricing data.' : null,
            ])->save();
        } catch (Throwable $exception) {
            // Whole-sync failure (API down, auth error, etc.) — existing
            // domain_pricing rows are never touched in this branch.
            $log->forceFill([
                'status' => 'failed',
                'completed_at' => now(),
                'total_tlds_found' => $found,
                'total_tlds_created' => $created,
                'total_tlds_updated' => $updated,
                'total_tlds_failed' => $failed,
                'error_message' => $exception->getMessage(),
            ])->save();
        }

        return $log->fresh();
    }

    /**
     * @param  array{tld: string, currency: string, registrationPrice: int, renewalPrice: int, transferPrice: int}  $item
     * @return bool true if a new TLD row was created, false if an existing one was updated.
     */
    private function upsertTld(array $item, DomainPricingSettings $settings): bool
    {
        $tld = $item['tld'] ?? '';

        if (! $tld) {
            throw new \RuntimeException('Spaceship returned a TLD price entry with no TLD name.');
        }

        $pricing = DomainPricing::query()->where('provider', 'spaceship')->where('tld', $tld)->first();
        $isNew = ! $pricing;

        if (! $pricing) {
            $pricing = new DomainPricing([
                'provider' => 'spaceship',
                'tld' => $tld,
                'status' => 'needs_review',
                'markup_type' => $settings->default_markup_type,
                'markup_value_kobo' => $settings->default_markup_value_kobo,
                'markup_percent' => $settings->default_markup_percent,
            ]);
        }

        // Spaceship is always the source of truth for provider cost — this
        // overwrites on every sync regardless of what else changed locally.
        $pricing->provider_currency = $item['currency'];
        $pricing->provider_registration_price_minor = $item['registrationPrice'];
        $pricing->provider_renewal_price_minor = $item['renewalPrice'];
        $pricing->provider_transfer_price_minor = $item['transferPrice'];
        $pricing->currency = 'NGN';

        // The FX rate/buffer used is copied from the global settings at
        // sync time (for per-TLD audit visibility) — never hand-edited per
        // TLD, so every TLD always reflects the current admin-set rate.
        $pricing->exchange_rate_to_ngn = $settings->exchange_rate;
        $pricing->safety_buffer_percent = $settings->safety_buffer_percent;

        $pricing->registration_price_kobo = $this->convertToNgnKobo($item['registrationPrice'], $settings);
        $pricing->renewal_price_kobo = $this->convertToNgnKobo($item['renewalPrice'], $settings);
        $pricing->transfer_price_kobo = $this->convertToNgnKobo($item['transferPrice'], $settings);

        // Markup (and fixed_customer_price_kobo/status) is NEVER touched
        // here for an existing row — it stays entirely under admin control.
        // Customer prices are never stored; DomainPricingService computes
        // them fresh from cost + markup on every read, so they can never go
        // stale relative to whatever markup is currently configured.
        $pricing->last_synced_at = now();
        $pricing->last_sync_status = 'success';
        $pricing->last_sync_error = null;
        $pricing->save();

        return $isNew;
    }

    /**
     * provider price minor units (e.g. USD cents) × NGN exchange rate ×
     * (1 + safety buffer %) — the /100 (minor→major) and ×100 (naira→kobo)
     * cancel out, so this multiplies the minor-unit integer directly.
     */
    private function convertToNgnKobo(int $providerPriceMinor, DomainPricingSettings $settings): int
    {
        $buffered = 1 + ((float) $settings->safety_buffer_percent / 100);

        return (int) round($providerPriceMinor * (float) $settings->exchange_rate * $buffered);
    }
}
