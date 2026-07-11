<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use App\Services\Media\PexelsImageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PexelsImageServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.pexels.api_key' => 'test-pexels-key', 'services.pexels.cache_ttl' => 86400]);
    }

    private function fakePexelsResponse(): array
    {
        return [
            'photos' => [
                [
                    'id' => 123,
                    'width' => 1200,
                    'height' => 800,
                    'url' => 'https://www.pexels.com/photo/123',
                    'photographer' => 'Jane Doe',
                    'avg_color' => '#123456',
                    'alt' => 'Business owner using a laptop',
                    'src' => ['large' => 'https://images.pexels.com/photos/123/large.jpg', 'original' => 'https://images.pexels.com/photos/123/original.jpg'],
                ],
            ],
        ];
    }

    public function test_search_calls_the_real_api_and_caches_the_result(): void
    {
        Http::fake(['api.pexels.com/*' => Http::response($this->fakePexelsResponse(), 200)]);

        $results = app(PexelsImageService::class)->search('web hosting server', 'landscape', 1);

        $this->assertSame('https://images.pexels.com/photos/123/large.jpg', $results[0]['url']);
        $this->assertSame('Jane Doe', $results[0]['photographer']);
        $this->assertSame(1, MediaAsset::query()->count());

        Http::assertSentCount(1);
    }

    public function test_a_second_call_with_the_same_query_uses_the_cache_and_never_calls_the_api_again(): void
    {
        Http::fake(['api.pexels.com/*' => Http::response($this->fakePexelsResponse(), 200)]);

        app(PexelsImageService::class)->search('web hosting server', 'landscape', 1);
        $second = app(PexelsImageService::class)->search('web hosting server', 'landscape', 1);

        Http::assertSentCount(1);
        $this->assertSame('https://images.pexels.com/photos/123/large.jpg', $second[0]['url']);
    }

    public function test_a_failed_api_call_falls_back_to_a_stale_cached_copy_when_one_exists(): void
    {
        Http::fake(['api.pexels.com/*' => Http::response($this->fakePexelsResponse(), 200)]);
        app(PexelsImageService::class)->search('web hosting server', 'landscape', 1);

        // Force the cached row to look stale.
        MediaAsset::query()->update(['updated_at' => now()->subDays(30)]);

        Http::fake(['api.pexels.com/*' => Http::response([], 500)]);
        $results = app(PexelsImageService::class)->search('web hosting server', 'landscape', 1);

        $this->assertSame('https://images.pexels.com/photos/123/large.jpg', $results[0]['url']);
    }

    public function test_no_configured_api_key_returns_the_local_placeholder_without_ever_calling_pexels(): void
    {
        config(['services.pexels.api_key' => null]);
        Http::fake();

        $results = app(PexelsImageService::class)->search('web hosting server');

        $this->assertSame('/images/placeholder-business.svg', $results[0]['url']);
        Http::assertNothingSent();
    }

    public function test_an_api_failure_with_no_cache_at_all_falls_back_to_the_local_placeholder(): void
    {
        Http::fake(['api.pexels.com/*' => Http::response([], 500)]);

        $results = app(PexelsImageService::class)->search('web hosting server');

        $this->assertSame('/images/placeholder-business.svg', $results[0]['url']);
    }

    public function test_first_image_for_returns_a_single_flat_result(): void
    {
        Http::fake(['api.pexels.com/*' => Http::response($this->fakePexelsResponse(), 200)]);

        $image = app(PexelsImageService::class)->firstImageFor('web hosting server');

        $this->assertSame('https://images.pexels.com/photos/123/large.jpg', $image['url']);
        $this->assertSame('Business owner using a laptop', $image['alt_text']);
    }
}
