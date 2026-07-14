<?php

namespace Tests\Feature;

use App\Exceptions\CloudflareApiException;
use App\Models\DomainSyncLog;
use App\Services\Domains\Registrars\CloudflareRegistrarClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CloudflareRegistrarClientTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_mode_never_makes_a_real_http_call(): void
    {
        Http::fake();
        config(['services.cloudflare.sandbox_mode' => true]);

        $result = app(CloudflareRegistrarClient::class)->listRegistrations();

        $this->assertArrayHasKey('items', $result);
        Http::assertNothingSent();

        $this->assertDatabaseHas('domain_sync_logs', [
            'provider' => 'cloudflare',
            'action' => 'full_sync',
            'status' => 'dry_run',
        ]);
    }

    public function test_dry_run_logs_never_contain_the_auth_code_or_token(): void
    {
        Http::fake();
        config(['services.cloudflare.sandbox_mode' => true]);

        app(CloudflareRegistrarClient::class)->initiateTransfer('secretive.com', 'SUPER-SECRET-EPP-CODE', [
            'registrant' => 'contact-1',
        ]);

        $log = DomainSyncLog::where('provider', 'cloudflare')->where('action', 'transfer')->firstOrFail();
        $summary = json_encode($log->response_summary);

        $this->assertStringNotContainsString('SUPER-SECRET-EPP-CODE', $summary);
    }

    public function test_live_mode_sends_bearer_token_and_never_logs_it(): void
    {
        config(['services.cloudflare.sandbox_mode' => false]);
        config(['services.cloudflare.account_id' => 'THE-ACCOUNT-ID']);
        config(['services.cloudflare.registrar_api_token' => 'THE-REAL-TOKEN']);
        config(['services.cloudflare.base_url' => 'https://cloudflare.test/client/v4']);

        Http::fake([
            'cloudflare.test/*' => Http::response(['success' => true, 'result' => [], 'result_info' => ['page' => 1, 'per_page' => 50, 'count' => 0, 'total_count' => 0]], 200),
        ]);

        app(CloudflareRegistrarClient::class)->listRegistrations();

        Http::assertSent(function ($request) {
            return $request->hasHeader('Authorization', 'Bearer THE-REAL-TOKEN');
        });

        $log = DomainSyncLog::where('provider', 'cloudflare')->where('action', 'full_sync')->where('status', 'success')->firstOrFail();
        $summary = json_encode($log->response_summary);

        $this->assertStringNotContainsString('THE-REAL-TOKEN', $summary);
    }

    public function test_live_mode_failure_is_logged_without_exposing_the_token(): void
    {
        config(['services.cloudflare.sandbox_mode' => false]);
        config(['services.cloudflare.account_id' => 'THE-ACCOUNT-ID']);
        config(['services.cloudflare.registrar_api_token' => 'ANOTHER-REAL-TOKEN']);
        config(['services.cloudflare.base_url' => 'https://cloudflare.test/client/v4']);

        Http::fake([
            'cloudflare.test/*' => Http::response(['success' => false, 'errors' => [['message' => 'Authentication error.']]], 403),
        ]);

        try {
            app(CloudflareRegistrarClient::class)->listRegistrations();
            $this->fail('Expected a CloudflareApiException to be thrown for a failed response.');
        } catch (CloudflareApiException $exception) {
            // Expected.
        }

        $log = DomainSyncLog::where('provider', 'cloudflare')->where('action', 'full_sync')->firstOrFail();
        $summary = json_encode($log->response_summary);

        $this->assertStringNotContainsString('ANOTHER-REAL-TOKEN', $summary);
    }

    public function test_forcing_live_calls_never_happens_in_the_testing_environment_even_with_real_credentials(): void
    {
        // sandbox_mode left at its .env default (true) deliberately — this
        // proves real credentials alone can't flip a test environment live.
        config(['services.cloudflare.account_id' => 'A-REAL-LOOKING-ACCOUNT-ID']);
        config(['services.cloudflare.registrar_api_token' => 'A-REAL-LOOKING-TOKEN']);
        Http::fake();

        app(CloudflareRegistrarClient::class)->listRegistrations();

        Http::assertNothingSent();
    }

    public function test_get_registration_returns_null_for_a_missing_domain_rather_than_throwing(): void
    {
        config(['services.cloudflare.sandbox_mode' => false]);
        config(['services.cloudflare.account_id' => 'THE-ACCOUNT-ID']);
        config(['services.cloudflare.registrar_api_token' => 'A-TOKEN']);
        config(['services.cloudflare.base_url' => 'https://cloudflare.test/client/v4']);

        Http::fake([
            'cloudflare.test/*' => Http::response(['success' => false, 'errors' => [['message' => 'domain not found']]], 404),
        ]);

        $result = app(CloudflareRegistrarClient::class)->getRegistration('missing-domain.com');

        $this->assertNull($result);
    }
}
