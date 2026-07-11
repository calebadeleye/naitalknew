<?php

namespace App\Services\Media;

use App\Models\MediaAsset;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Fetches business-friendly stock images from Pexels for hero sections,
 * cards, and blog/knowledge-base thumbnails — never called on every page
 * load, since every search is cached as one media_assets row (keyed by
 * query+orientation+count) and reused until it goes stale
 * (services.pexels.cache_ttl). If Pexels is unreachable or no API key is
 * configured, callers always get a usable local placeholder instead of a
 * broken image or a thrown exception.
 */
class PexelsImageService
{
    private const FALLBACK_IMAGE = [
        'url' => '/images/placeholder-business.svg',
        'alt_text' => 'NAI TALK',
        'photographer' => null,
        'provider_url' => null,
        'source_id' => null,
        'metadata' => [],
    ];

    /**
     * @return array{url: string, alt_text: string, photographer: ?string, provider_url: ?string, source_id: ?string, metadata: array}
     */
    public function firstImageFor(string $query, string $orientation = 'landscape'): array
    {
        $results = $this->search($query, $orientation, 1);

        return $results[0] ?? array_merge(self::FALLBACK_IMAGE, ['alt_text' => Str::title($query)]);
    }

    /**
     * @return array<int, array{url: string, alt_text: string, photographer: ?string, provider_url: ?string, source_id: ?string, metadata: array}>
     */
    public function search(string $query, string $orientation = 'landscape', int $perPage = 1): array
    {
        $perPage = max(1, min($perPage, 10));
        $cacheKey = $this->cacheKey($query, $orientation, $perPage);
        $ttl = (int) config('services.pexels.cache_ttl', 86400);

        $cached = MediaAsset::query()->where('cache_key', $cacheKey)->first();

        if ($cached && $cached->updated_at && $cached->updated_at->diffInSeconds(now()) < $ttl) {
            return $cached->metadata['photos'] ?? [array_merge(self::FALLBACK_IMAGE, ['alt_text' => Str::title($query)])];
        }

        $apiKey = config('services.pexels.api_key');

        if (! $apiKey) {
            // No key configured — this is expected until an admin sets
            // PEXELS_API_KEY, not an error worth logging on every request.
            return [array_merge(self::FALLBACK_IMAGE, ['alt_text' => Str::title($query)])];
        }

        try {
            $response = Http::withHeaders(['Authorization' => $apiKey])
                ->timeout(6)
                ->get('https://api.pexels.com/v1/search', [
                    'query' => $query,
                    'orientation' => $orientation,
                    'per_page' => $perPage,
                ]);

            if (! $response->successful()) {
                throw new \RuntimeException("Pexels API returned status {$response->status()}");
            }

            $photos = $response->json('photos') ?? [];

            if (! $photos) {
                return [array_merge(self::FALLBACK_IMAGE, ['alt_text' => Str::title($query)])];
            }

            $results = array_map(fn (array $photo) => [
                'url' => $photo['src']['large'] ?? $photo['src']['original'] ?? self::FALLBACK_IMAGE['url'],
                'alt_text' => $photo['alt'] ?: Str::title($query),
                'photographer' => $photo['photographer'] ?? null,
                'provider_url' => $photo['url'] ?? null,
                'source_id' => (string) ($photo['id'] ?? ''),
                'metadata' => [
                    'width' => $photo['width'] ?? null,
                    'height' => $photo['height'] ?? null,
                    'avg_color' => $photo['avg_color'] ?? null,
                ],
            ], $photos);

            MediaAsset::query()->updateOrCreate(
                ['cache_key' => $cacheKey],
                [
                    'source' => 'pexels',
                    'source_provider' => 'pexels',
                    'source_id' => $results[0]['source_id'],
                    'url' => $results[0]['url'],
                    'alt_text' => $results[0]['alt_text'],
                    'photographer' => $results[0]['photographer'],
                    'provider_url' => $results[0]['provider_url'],
                    'metadata' => ['query' => $query, 'orientation' => $orientation, 'photos' => $results],
                ],
            );

            return $results;
        } catch (\Throwable $exception) {
            Log::warning('Pexels image search failed, using fallback image.', [
                'query' => $query,
                'error' => $exception->getMessage(),
            ]);

            // A stale cached copy is still better than no image at all.
            if ($cached) {
                return $cached->metadata['photos'] ?? [array_merge(self::FALLBACK_IMAGE, ['alt_text' => Str::title($query)])];
            }

            return [array_merge(self::FALLBACK_IMAGE, ['alt_text' => Str::title($query)])];
        }
    }

    private function cacheKey(string $query, string $orientation, int $perPage): string
    {
        return 'pexels:'.$orientation.':'.$perPage.':'.Str::slug($query);
    }
}
