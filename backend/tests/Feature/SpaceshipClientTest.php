<?php

namespace Tests\Feature;

use App\Models\DomainSyncLog;
use App\Services\Domains\SpaceshipClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SpaceshipClientTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_mode_never_makes_a_real_http_call(): void
    {
        Http::fake();
        config(['services.spaceship.sandbox_mode' => true]);

        $result = app(SpaceshipClient::class)->checkAvailability('dryrun-example.com');

        $this->assertArrayHasKey('available', $result);
        Http::assertNothingSent();

        $this->assertDatabaseHas('domain_sync_logs', [
            'action' => 'availability_check',
            'status' => 'dry_run',
        ]);
    }

    public function test_dry_run_logs_never_contain_api_secrets_or_auth_codes(): void
    {
        Http::fake();
        config(['services.spaceship.sandbox_mode' => true]);

        app(SpaceshipClient::class)->initiateTransfer('secretive.com', 'SUPER-SECRET-EPP-CODE', [
            'registrant' => 'contact-1', 'admin' => 'contact-1', 'tech' => 'contact-1', 'billing' => 'contact-1',
        ]);

        $log = DomainSyncLog::where('action', 'initiate_transfer')->firstOrFail();
        $summary = json_encode($log->response_summary);

        $this->assertStringNotContainsString('SUPER-SECRET-EPP-CODE', $summary);
    }

    public function test_live_mode_sends_api_key_and_secret_as_headers_and_never_logs_them(): void
    {
        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'THE-REAL-API-KEY']);
        config(['services.spaceship.api_secret' => 'THE-REAL-API-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/*' => Http::response(['name' => 'live-example.com', 'available' => true], 200),
        ]);

        app(SpaceshipClient::class)->checkAvailability('live-example.com');

        Http::assertSent(function ($request) {
            return $request->hasHeader('X-API-Key', 'THE-REAL-API-KEY')
                && $request->hasHeader('X-API-Secret', 'THE-REAL-API-SECRET');
        });

        $log = DomainSyncLog::where('action', 'availability_check')->where('status', 'success')->firstOrFail();
        $summary = json_encode($log->response_summary);

        $this->assertStringNotContainsString('THE-REAL-API-KEY', $summary);
        $this->assertStringNotContainsString('THE-REAL-API-SECRET', $summary);
    }

    public function test_live_mode_failure_is_logged_without_exposing_secrets(): void
    {
        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'ANOTHER-REAL-KEY']);
        config(['services.spaceship.api_secret' => 'ANOTHER-REAL-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/*' => Http::response(['message' => 'Domain not found'], 404),
        ]);

        try {
            app(SpaceshipClient::class)->getDomainInfo('missing-domain.com');
            $this->fail('Expected a SpaceshipApiException to be thrown for a failed response.');
        } catch (\App\Exceptions\SpaceshipApiException $exception) {
            // Expected.
        }

        $log = DomainSyncLog::where('action', 'domain_info')->firstOrFail();
        $summary = json_encode($log->response_summary);

        $this->assertStringNotContainsString('ANOTHER-REAL-KEY', $summary);
        $this->assertStringNotContainsString('ANOTHER-REAL-SECRET', $summary);
    }

    /**
     * Regression test: the real Spaceship API replies with
     * {domain, result: "available"|"unavailable", premiumPricing}, NOT
     * {available: bool}. Before this fix, every real response was silently
     * misread as unavailable.
     */
    public function test_real_api_response_shape_is_parsed_correctly_for_available_and_unavailable(): void
    {
        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'TEST-KEY']);
        config(['services.spaceship.api_secret' => 'TEST-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/api/v1/domains/free-one.com/available' => Http::response([
                'domain' => 'free-one.com', 'result' => 'available', 'premiumPricing' => null,
            ], 200),
            'spaceship.test/api/v1/domains/taken-one.com/available' => Http::response([
                'domain' => 'taken-one.com', 'result' => 'unavailable', 'premiumPricing' => null,
            ], 200),
        ]);

        $available = app(SpaceshipClient::class)->checkAvailability('free-one.com');
        $taken = app(SpaceshipClient::class)->checkAvailability('taken-one.com');

        $this->assertTrue($available['available']);
        $this->assertFalse($taken['available']);
    }

    /**
     * Observed for real: Spaceship reports "tldNotSupported" for extensions
     * this account/API tier can't sell at all (e.g. .ng ccTLDs) — distinct
     * from "someone else already owns this name".
     */
    public function test_tld_not_supported_is_distinguished_from_unavailable(): void
    {
        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'TEST-KEY']);
        config(['services.spaceship.api_secret' => 'TEST-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/api/v1/domains/example.ng/available' => Http::response([
                'domain' => 'example.ng', 'result' => 'tldNotSupported', 'premiumPricing' => null,
            ], 200),
        ]);

        $result = app(SpaceshipClient::class)->checkAvailability('example.ng');

        $this->assertFalse($result['available']);
        $this->assertFalse($result['tld_supported']);
    }

    public function test_bulk_availability_check_parses_the_real_response_shape(): void
    {
        config(['services.spaceship.sandbox_mode' => false]);
        config(['services.spaceship.api_key' => 'TEST-KEY']);
        config(['services.spaceship.api_secret' => 'TEST-SECRET']);
        config(['services.spaceship.base_url' => 'https://spaceship.test/api/v1']);

        Http::fake([
            'spaceship.test/api/v1/domains/available' => Http::response([
                ['domain' => 'alt-one.ng', 'result' => 'available'],
                ['domain' => 'alt-two.org', 'result' => 'unavailable'],
            ], 200),
        ]);

        $results = app(SpaceshipClient::class)->checkAvailabilityBulk(['alt-one.ng', 'alt-two.org']);

        $this->assertTrue($results[0]['available']);
        $this->assertFalse($results[1]['available']);
    }

    public function test_forcing_live_availability_checks_never_happens_in_the_testing_environment_even_with_real_credentials(): void
    {
        // sandbox_mode left at its .env default (true) deliberately — this
        // proves real credentials alone can't flip a test environment live.
        config(['services.spaceship.api_key' => 'A-REAL-LOOKING-KEY']);
        config(['services.spaceship.api_secret' => 'A-REAL-LOOKING-SECRET']);
        Http::fake();

        app(SpaceshipClient::class)->checkAvailability('never-goes-live.com');

        Http::assertNothingSent();
    }
}
