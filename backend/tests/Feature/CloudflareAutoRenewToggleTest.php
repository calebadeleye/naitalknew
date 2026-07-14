<?php

namespace Tests\Feature;

use App\Jobs\SyncCloudflareDomainJob;
use App\Models\Domain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class CloudflareAutoRenewToggleTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
        config(['services.cloudflare.sandbox_mode' => true]);
    }

    public function test_toggling_auto_renew_for_a_cloudflare_domain_goes_through_the_registrar_and_stays_pending_locally(): void
    {
        Queue::fake();
        Http::fake();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('cf-toggle@example.test');

        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'cftoggle.com',
            'tld' => '.com',
            'source' => 'cloudflare_imported',
            'registration_source' => 'imported',
            'provider' => 'cloudflare',
            'provider_domain_id' => 'cf-toggle-1',
            'status' => 'active',
            'ownership_assignment_status' => 'assigned',
            'auto_renew' => true,
        ]);

        $response = $this->withToken($token)->patchJson("/api/v1/client/domains/{$domain->id}/auto-renew", ['auto_renew' => false])->assertOk();

        $response->assertJsonPath('auto_renew_confirmation_pending', true);
        // The local column must NOT be optimistically flipped for Cloudflare.
        $this->assertTrue($domain->fresh()->auto_renew);

        Queue::assertPushed(SyncCloudflareDomainJob::class, fn ($job) => $job->domain->is($domain));

        $this->assertDatabaseHas('domain_sync_logs', [
            'provider' => 'cloudflare',
            'action' => 'auto_renew_update',
        ]);
    }

    public function test_toggling_auto_renew_for_a_spaceship_domain_is_unchanged_immediate_local_flip(): void
    {
        Queue::fake();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('ss-toggle@example.test');

        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'sstoggle.com',
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
            'auto_renew' => true,
        ]);

        $response = $this->withToken($token)->patchJson("/api/v1/client/domains/{$domain->id}/auto-renew", ['auto_renew' => false])->assertOk();

        $response->assertJsonPath('auto_renew_confirmation_pending', false);
        $this->assertFalse($domain->fresh()->auto_renew);

        Queue::assertNotPushed(SyncCloudflareDomainJob::class);
    }
}
