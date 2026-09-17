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
 * Looked up server-to-server against a free geolocation API and cached per
 * IP for 30 days — most visitors share a small pool of IPs (ISPs, mobile
 * carriers), so this keeps outbound lookups rare. Never throws: a failed or
 * rate-limited lookup just means "location unknown" for that visit, not a
 * broken pageview.
 */
class GeoIpLookupService
{
    private const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

    private const PRIVATE_IP_RESULT = [
        'country' => null,
        'country_code' => null,
        'city' => null,
    ];

    /**
     * @return array{country: ?string, country_code: ?string, city: ?string}
     */
    public function lookup(string $ip): array
    {
        if ($this->isPrivateOrLocal($ip)) {
            return self::PRIVATE_IP_RESULT;
        }

        return Cache::remember("geoip:{$ip}", self::CACHE_TTL_SECONDS, function () use ($ip) {
            try {
                $response = Http::timeout(4)->get("https://ipapi.co/{$ip}/json/");

                if (! $response->successful()) {
                    throw new \RuntimeException("ipapi.co returned status {$response->status()}");
                }

                $body = $response->json();

                if (! is_array($body) || isset($body['error'])) {
                    return self::PRIVATE_IP_RESULT;
                }

                return [
                    'country' => $body['country_name'] ?? null,
                    'country_code' => $body['country_code'] ?? null,
                    'city' => $body['city'] ?? null,
                ];
            } catch (\Throwable $exception) {
                Log::warning('GeoIP lookup failed, location will be unknown for this visit.', [
                    'error' => $exception->getMessage(),
                ]);

                return self::PRIVATE_IP_RESULT;
            }
        });
    }

    private function isPrivateOrLocal(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
    }
}
