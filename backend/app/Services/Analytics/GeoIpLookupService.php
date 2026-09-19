<?php

namespace App\Services\Analytics;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Resolves an IP address to a coarse country/city, so the admin analytics
 * dashboard can show "where visitors are from" without depending on
 * Google (or any client-side script an ad-blocker could strip).
 *
 * Tries two free, keyless providers in order — ipwho.is first, then
 * geolocation-db.com — since a shared hosting box's outbound IP can burn
 * through one provider's free-tier rate limit on its own (this is exactly
 * what happened with ipapi.co, the original single provider here). Only a
 * successful lookup is cached; a failed/rate-limited attempt is never
 * cached, so the next visit from that IP gets a fresh retry instead of
 * being stuck as "unknown" for 30 days.
 */
class GeoIpLookupService
{
    private const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

    private const UNKNOWN_RESULT = [
        'country' => null,
        'country_code' => null,
        'city' => null,
        'network' => null,
        'asn' => null,
    ];

    /**
     * @return array{country: ?string, country_code: ?string, city: ?string, network: ?string, asn: ?int}
     */
    public function lookup(string $ip): array
    {
        if ($this->isPrivateOrLocal($ip)) {
            return self::UNKNOWN_RESULT;
        }

        $cacheKey = "geoip:{$ip}";
        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached + self::UNKNOWN_RESULT;
        }

        $result = $this->queryIpwhoIs($ip) ?? $this->queryGeolocationDb($ip);

        if ($result !== null) {
            Cache::put($cacheKey, $result, self::CACHE_TTL_SECONDS);

            return $result;
        }

        return self::UNKNOWN_RESULT;
    }

    /**
     * @return array{country: ?string, country_code: ?string, city: ?string, network: ?string, asn: ?int}|null
     */
    private function queryIpwhoIs(string $ip): ?array
    {
        try {
            $response = Http::timeout(4)->get("https://ipwho.is/{$ip}");

            if (! $response->successful()) {
                throw new \RuntimeException("ipwho.is returned status {$response->status()}");
            }

            $body = $response->json();

            if (! is_array($body) || ($body['success'] ?? true) === false) {
                return null;
            }

            $asn = $body['connection']['asn'] ?? null;
            $isp = $body['connection']['isp'] ?? $body['connection']['org'] ?? null;

            return [
                'country' => $body['country'] ?? null,
                'country_code' => $body['country_code'] ?? null,
                'city' => $body['city'] ?? null,
                'network' => $isp ? trim(($asn ? "AS{$asn} " : '').$isp) : null,
                'asn' => $asn ? (int) $asn : null,
            ];
        } catch (\Throwable $exception) {
            Log::warning('GeoIP lookup via ipwho.is failed, trying fallback provider.', [
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @return array{country: ?string, country_code: ?string, city: ?string, network: ?string, asn: ?int}|null
     */
    private function queryGeolocationDb(string $ip): ?array
    {
        try {
            $response = Http::timeout(4)->get("https://geolocation-db.com/json/{$ip}");

            if (! $response->successful()) {
                throw new \RuntimeException("geolocation-db.com returned status {$response->status()}");
            }

            $body = $response->json();

            if (! is_array($body) || ! ($body['country_name'] ?? null) || $body['country_name'] === 'Not found') {
                return null;
            }

            return [
                'country' => $body['country_name'] ?? null,
                'country_code' => $body['country_code'] ?? null,
                'city' => ($body['city'] ?? null) === 'Not found' ? null : ($body['city'] ?? null),
                'network' => null,
                'asn' => null,
            ];
        } catch (\Throwable $exception) {
            Log::warning('GeoIP lookup via geolocation-db.com fallback also failed, location will be unknown for this visit.', [
                'error' => $exception->getMessage(),
            ]);

            return null;
        }
    }

    private function isPrivateOrLocal(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }
}
