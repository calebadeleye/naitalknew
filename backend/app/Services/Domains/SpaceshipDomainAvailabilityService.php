<?php

namespace App\Services\Domains;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Spaceship is the sole source of truth for availability — this service
 * never fabricates a result. A successful "available" check is remembered
 * for a short window so checkout can refuse to proceed against a stale
 * verification (see wasRecentlyVerifiedAvailable()).
 */
class SpaceshipDomainAvailabilityService
{
    private const VERIFIED_TTL_MINUTES = 10;

    /**
     * The only TLDs the admin can configure pricing for — suggestions are
     * only ever generated using these, so every suggestion shown always has
     * a real, priced "Buy" path (never a dead end with no price).
     */
    private const SUPPORTED_TLDS = ['.com', '.ng', '.com.ng', '.org', '.net', '.org.ng'];

    private const NAME_PREFIXES = ['get', 'my', 'try', 'the'];

    private const NAME_SUFFIXES = ['hq', 'app', 'online', 'hub', '247'];

    public function __construct(
        private readonly SpaceshipClient $client,
        private readonly DomainPricingService $pricing,
    ) {
    }

    /**
     * @return array{domain: string, tld: string, available: bool, tld_supported: bool, premium: bool, registration_price_kobo: ?int, renewal_price_kobo: ?int, transfer_price_kobo: ?int, currency: ?string, suggestions: array}
     */
    public function search(string $domain): array
    {
        $domain = $this->normalize($domain);
        $tld = $this->extractTld($domain);

        $result = $this->client->checkAvailability($domain);
        $available = (bool) ($result['available'] ?? false);
        $tldSupported = (bool) ($result['tld_supported'] ?? true);

        if ($available) {
            $this->markVerified($domain);
        }

        $price = $this->pricing->priceFor($tld);

        return [
            'domain' => $domain,
            'tld' => $tld,
            'available' => $available,
            'tld_supported' => $tldSupported,
            'premium' => (bool) ($result['premium'] ?? false),
            'registration_price_kobo' => $price['registration_kobo'] ?? null,
            'renewal_price_kobo' => $price['renewal_kobo'] ?? null,
            'transfer_price_kobo' => $price['transfer_kobo'] ?? null,
            'currency' => $price['currency'] ?? null,
            // Suggestions are a nice-to-have enhancement on top of the
            // primary (already-successful) availability result above — a
            // hiccup generating them must never turn a good result into a
            // 503 for the user.
            'suggestions' => $available ? [] : $this->safeSuggestionsFor($domain, $tld),
        ];
    }

    /**
     * @return array<int, array{domain: string, tld: string, registration_price_kobo: int, renewal_price_kobo: int, currency: string}>
     */
    private function safeSuggestionsFor(string $domain, string $tld): array
    {
        try {
            return $this->suggestionsFor($domain, $tld);
        } catch (\Throwable $exception) {
            return [];
        }
    }

    /**
     * Spaceship has no domain-suggestions endpoint, so alternatives are
     * generated locally (same base name across the admin-priced TLDs, plus
     * prefix/suffix variants), then checked for real availability in a
     * single bulk call and filtered down to ones that are both available
     * and actually priced — so every suggestion shown has a working "Buy"
     * button, never a dead end.
     *
     * @return array<int, array{domain: string, tld: string, registration_price_kobo: int, renewal_price_kobo: int, currency: string}>
     */
    public function suggestionsFor(string $domain, ?string $tld = null): array
    {
        $domain = $this->normalize($domain);
        $tld = $tld ?? $this->extractTld($domain);
        $baseName = Str::of($domain)->beforeLast($tld)->toString();

        if (! $baseName) {
            return [];
        }

        $candidates = $this->generateCandidates($baseName, $tld);

        if (! $candidates) {
            return [];
        }

        $results = $this->client->checkAvailabilityBulk($candidates);

        $suggestions = [];

        foreach ($results as $result) {
            if (! ($result['available'] ?? false)) {
                continue;
            }

            $candidateDomain = $result['domain'] ?? '';
            $candidateTld = $this->extractTld($candidateDomain);
            $price = $this->pricing->priceFor($candidateTld);

            if (! $price) {
                continue;
            }

            $suggestions[] = [
                'domain' => $candidateDomain,
                'tld' => $candidateTld,
                'registration_price_kobo' => $price['registration_kobo'],
                'renewal_price_kobo' => $price['renewal_kobo'],
                'currency' => $price['currency'],
            ];
        }

        return array_slice($suggestions, 0, 15);
    }

    /**
     * @return array<int, string>
     */
    private function generateCandidates(string $baseName, string $originalTld): array
    {
        $candidates = [];

        foreach (self::SUPPORTED_TLDS as $tld) {
            if ($tld !== $originalTld) {
                $candidates[] = $baseName.$tld;
            }
        }

        foreach (self::NAME_PREFIXES as $prefix) {
            $candidates[] = "{$prefix}{$baseName}.com";
        }

        foreach (self::NAME_SUFFIXES as $suffix) {
            $candidates[] = "{$baseName}{$suffix}.com";
        }

        return array_slice(array_values(array_unique($candidates)), 0, 15);
    }

    public function wasRecentlyVerifiedAvailable(string $domain): bool
    {
        return Cache::has($this->cacheKey($this->normalize($domain)));
    }

    /**
     * Consumes the verification — used right before registering so the same
     * stale "yes it was available 9 minutes ago" check can't be reused twice.
     */
    public function forgetVerification(string $domain): void
    {
        Cache::forget($this->cacheKey($this->normalize($domain)));
    }

    private function markVerified(string $domain): void
    {
        Cache::put($this->cacheKey($domain), true, now()->addMinutes(self::VERIFIED_TTL_MINUTES));
    }

    private function cacheKey(string $domain): string
    {
        return 'domain_availability_verified:'.$domain;
    }

    public function normalize(string $domain): string
    {
        return Str::of($domain)->lower()->trim()->toString();
    }

    public function extractTld(string $domain): string
    {
        $parts = explode('.', $domain);
        array_shift($parts);

        return '.'.implode('.', $parts);
    }
}
