<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\TestCase;

class DomainSearchTest extends TestCase
{
    use CreatesDomainFixtures, RefreshDatabase;

    public function test_domain_search_calls_spaceship_service_and_returns_availability_and_pricing(): void
    {
        $this->activateDomainPricing('.com');

        $response = $this->getJson('/api/v1/public/domains/search?domain=mybusiness.com')->assertOk();

        $response->assertJson([
            'domain' => 'mybusiness.com',
            'tld' => '.com',
            'available' => true,
        ]);
        $this->assertSame(2_300_000, $response->json('registration_price_kobo'));

        $this->assertDatabaseHas('domain_sync_logs', [
            'provider' => 'spaceship',
            'action' => 'availability_check',
        ]);
    }

    public function test_unavailable_domain_is_reported_as_unavailable_and_cannot_be_purchased(): void
    {
        $this->activateDomainPricing('.com');
        ['token' => $token] = $this->registerVerifiedDomainClient('search-unavailable@example.test');

        $this->getJson('/api/v1/public/domains/search?domain=alreadytaken.com')
            ->assertOk()
            ->assertJson(['available' => false]);

        // Never verified as available, so ordering it must be refused.
        $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'alreadytaken.com',
        ])->assertStatus(422);
    }

    public function test_domain_search_rejects_malformed_domain_names(): void
    {
        $this->getJson('/api/v1/public/domains/search?domain=not-a-domain')->assertStatus(422);
    }

    public function test_available_domain_returns_no_suggestions(): void
    {
        $this->activateDomainPricing('.com');

        $response = $this->getJson('/api/v1/public/domains/search?domain=freebrandname.com')->assertOk();

        $this->assertSame([], $response->json('suggestions'));
    }

    public function test_unavailable_domain_returns_priced_available_alternatives(): void
    {
        $this->activateDomainPricing('.com');
        $this->activateDomainPricing('.ng', ['registration_price_kobo' => 800_000, 'renewal_price_kobo' => 800_000, 'markup_value_kobo' => 200_000]);
        $this->activateDomainPricing('.org', ['registration_price_kobo' => 1_200_000, 'renewal_price_kobo' => 1_200_000, 'markup_value_kobo' => 300_000]);
        // .net and .com.ng/.org.ng are deliberately left un-activated (status
        // stays 'needs_review' from the seeder) so their suggestions are
        // filtered out even though Spaceship reports them as available.

        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'TEST-KEY']);
        config(['services.spaceship.api_secret' => 'TEST-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/api/v1/domains/mybrandx.com/available' => Http::response(['domain' => 'mybrandx.com', 'result' => 'unavailable'], 200),
            'spaceship.test/api/v1/domains/available' => Http::response([
                ['domain' => 'mybrandx.ng', 'result' => 'available'],
                ['domain' => 'mybrandx.com.ng', 'result' => 'available'],
                ['domain' => 'mybrandx.org', 'result' => 'available'],
                ['domain' => 'mybrandx.net', 'result' => 'available'],
                ['domain' => 'mybrandx.org.ng', 'result' => 'unavailable'],
                ['domain' => 'getmybrandx.com', 'result' => 'available'],
                ['domain' => 'mymybrandx.com', 'result' => 'unavailable'],
                ['domain' => 'trymybrandx.com', 'result' => 'unavailable'],
                ['domain' => 'themybrandx.com', 'result' => 'unavailable'],
                ['domain' => 'mybrandxhq.com', 'result' => 'unavailable'],
                ['domain' => 'mybrandxapp.com', 'result' => 'unavailable'],
                ['domain' => 'mybrandxonline.com', 'result' => 'unavailable'],
                ['domain' => 'mybrandxhub.com', 'result' => 'unavailable'],
                ['domain' => 'mybrandx247.com', 'result' => 'unavailable'],
            ], 200),
        ]);

        $response = $this->getJson('/api/v1/public/domains/search?domain=mybrandx.com')->assertOk();

        $this->assertFalse($response->json('available'));
        $suggestions = collect($response->json('suggestions'));
        $domains = $suggestions->pluck('domain');

        // Available AND priced (.ng, .org, getmybrandx.com on .com).
        $this->assertTrue($domains->contains('mybrandx.ng'));
        $this->assertTrue($domains->contains('mybrandx.org'));
        $this->assertTrue($domains->contains('getmybrandx.com'));
        // Available but NOT priced (.com.ng, .net) must be filtered out.
        $this->assertFalse($domains->contains('mybrandx.com.ng'));
        $this->assertFalse($domains->contains('mybrandx.net'));
        // Unavailable candidates must never appear regardless of pricing.
        $this->assertFalse($domains->contains('mybrandx.org.ng'));
        $this->assertFalse($domains->contains('mymybrandx.com'));

        $this->assertSame(2_300_000, $suggestions->firstWhere('domain', 'getmybrandx.com')['registration_price_kobo']);
    }

    public function test_search_reports_tld_not_supported_distinctly_from_unavailable(): void
    {
        $this->activateDomainPricing('.ng', ['registration_price_kobo' => 400_000, 'markup_value_kobo' => 0]);

        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'TEST-KEY']);
        config(['services.spaceship.api_secret' => 'TEST-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/api/v1/domains/somebrand.ng/available' => Http::response([
                'domain' => 'somebrand.ng', 'result' => 'tldNotSupported', 'premiumPricing' => null,
            ], 200),
            'spaceship.test/*' => Http::response(['results' => []], 200),
        ]);

        $response = $this->getJson('/api/v1/public/domains/search?domain=somebrand.ng')->assertOk();

        $this->assertFalse($response->json('available'));
        $this->assertFalse($response->json('tld_supported'));
    }

    public function test_a_suggestion_lookup_failure_never_breaks_the_primary_search_result(): void
    {
        $this->activateDomainPricing('.com');

        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'TEST-KEY']);
        config(['services.spaceship.api_secret' => 'TEST-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/api/v1/domains/stillworks.com/available' => Http::response(['domain' => 'stillworks.com', 'result' => 'unavailable'], 200),
            // The bulk suggestions call fails outright — must not surface as a 503.
            'spaceship.test/api/v1/domains/available' => Http::response(['message' => 'Internal error'], 500),
        ]);

        $response = $this->getJson('/api/v1/public/domains/search?domain=stillworks.com')->assertOk();

        $this->assertFalse($response->json('available'));
        $this->assertSame([], $response->json('suggestions'));
    }

    public function test_public_pricing_endpoint_lists_only_active_tlds_with_real_prices(): void
    {
        $this->activateDomainPricing('.com', ['registration_price_kobo' => 750_000, 'markup_value_kobo' => 0]);
        // .ng left at the seeder's default 'needs_review' status — must not appear.

        $response = $this->getJson('/api/v1/public/domains/pricing')->assertOk();
        $rows = collect($response->json('data'));

        $this->assertSame(750_000, $rows->firstWhere('tld', '.com')['registration_price_kobo']);
        $this->assertFalse($rows->contains('tld', '.ng'));
    }
}
