<?php

namespace Tests\Feature;

use App\Jobs\SyncCloudflareDomainJob;
use App\Models\Client;
use App\Models\Domain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SyncCloudflareDomainJobTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.cloudflare.sandbox_mode' => false]);
        config(['services.cloudflare.account_id' => 'ACCOUNT-ID']);
        config(['services.cloudflare.registrar_api_token' => 'A-TOKEN']);
        config(['services.cloudflare.base_url' => 'https://cloudflare.test/client/v4']);
    }

    private function makeClient(): Client
    {
        $user = User::factory()->create();

        return Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);
    }

    public function test_refresh_applies_the_same_field_scoping_rules_as_the_full_sync(): void
    {
        $client = $this->makeClient();
        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'single-refresh.com',
            'tld' => '.com',
            'source' => 'manual',
            'provider' => 'cloudflare',
            'provider_domain_id' => 'cf-single',
            'status' => 'active',
            'ownership_assignment_status' => 'assigned',
            'customer_renewal_price_kobo' => 300000,
            'provider_status' => 'expired',
        ]);

        Http::fake([
            'cloudflare.test/*' => Http::response([
                'success' => true,
                'result' => ['id' => 'cf-single', 'name' => 'single-refresh.com', 'status' => 'active', 'auto_renew' => true, 'expires_at' => '2029-01-01T00:00:00Z'],
            ], 200),
        ]);

        SyncCloudflareDomainJob::dispatchSync($domain);

        $domain->refresh();
        $this->assertSame($client->id, $domain->client_id);
        $this->assertSame(300000, $domain->customer_renewal_price_kobo);
        $this->assertSame('active', $domain->provider_status);
        $this->assertSame('2029-01-01', $domain->expires_at->toDateString());
        $this->assertNotNull($domain->last_synced_at);
    }

    public function test_refresh_is_a_no_op_for_a_non_cloudflare_domain(): void
    {
        $client = $this->makeClient();
        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'spaceship-owned.com',
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
        ]);

        SyncCloudflareDomainJob::dispatchSync($domain);

        Http::assertNothingSent();
    }
}
