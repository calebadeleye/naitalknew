<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Models\User;
use App\Services\Ispconfig\FakeIspConfigClient;
use App\Services\Ispconfig\IpBlockList;
use App\Services\Ssl\FakeCertificateChecker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class IpBlockingTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private FakeIspConfigClient $fake;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fake = $this->fakeIspConfig();
        $this->app->instance(\App\Services\Ssl\LiveCertificateChecker::class, new FakeCertificateChecker);
    }

    /** @return array{0: HostingService, 1: string} */
    private function siteWithClientToken(): array
    {
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);
        $user = $service->client->user;
        $user->forceFill(['password' => Hash::make('secret-password')])->save();
        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])->assertOk()->json('token');

        return [$service->fresh(), $token];
    }

    private function directives(HostingService $service): string
    {
        return (string) $this->fake->sitesWebDomainGet($this->fake->login(), (int) $service->ispConfigServiceMappings()->value('ispconfig_website_id'))['apache_directives'];
    }

    public function test_a_client_blocks_an_address_and_a_range_without_disturbing_their_other_apache_settings(): void
    {
        [$service, $token] = $this->siteWithClientToken();
        $websiteId = (int) $service->ispConfigServiceMappings()->value('ispconfig_website_id');
        $this->fake->sitesWebDomainUpdate($this->fake->login(), 0, $websiteId, ['apache_directives' => 'Header set X-Mine "yes"']);
        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/proxy", ['port' => 3005])->assertOk();

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/blocked-ips", ['ip' => '203.0.113.5', 'note' => 'login spam'])
            ->assertOk()
            ->assertJsonPath('blocked_ips.0.ip', '203.0.113.5')
            ->assertJsonPath('blocked_ips.0.added_by', 'client');
        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/blocked-ips", ['ip' => '198.51.100.0/24'])->assertOk();

        $directives = $this->directives($service);
        $this->assertStringContainsString("<If \"-R '203.0.113.5' || -R '198.51.100.0/24'\">", $directives);
        $this->assertStringContainsString('Require all denied', $directives);
        $this->assertStringContainsString('Header set X-Mine "yes"', $directives);
        $this->assertStringContainsString('ProxyPass / http://127.0.0.1:3005/', $directives, 'the proxy rule must survive');

        // Changing the proxy must not drop the block either.
        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/proxy", ['port' => 3006])->assertOk();
        $this->assertStringContainsString("-R '203.0.113.5'", $this->directives($service));

        $this->withToken($token)->deleteJson("/api/v1/client/services/{$service->id}/website/blocked-ips", ['ip' => '203.0.113.5'])->assertOk()->assertJsonCount(1, 'blocked_ips');
        $this->withToken($token)->deleteJson("/api/v1/client/services/{$service->id}/website/blocked-ips", ['ip' => '198.51.100.0/24'])->assertOk();

        $this->assertStringNotContainsString('NAI-TALK-IPBLOCK', $this->directives($service));
        $this->assertStringContainsString('ProxyPass / http://127.0.0.1:3006/', $this->directives($service));
    }

    public function test_private_addresses_wide_ranges_garbage_and_duplicates_are_refused(): void
    {
        [$service, $token] = $this->siteWithClientToken();
        $url = "/api/v1/client/services/{$service->id}/website/blocked-ips";

        foreach (['127.0.0.1', '10.0.0.5', '192.168.1.0/24', '203.0.0.0/8', 'not-an-ip', '203.0.113.5/40'] as $bad) {
            $this->withToken($token)->postJson($url, ['ip' => $bad])->assertStatus(422)->assertJsonValidationErrors('ip');
        }

        $this->withToken($token)->postJson($url, ['ip' => '203.0.113.9'])->assertOk();
        $this->withToken($token)->postJson($url, ['ip' => '203.0.113.9'])->assertStatus(422);
        $this->assertSame('2a00:1450::1', IpBlockList::normalize('2a00:1450:0000::0001'));
        $this->assertSame('2a00:1450::/32', IpBlockList::normalize('2a00:1450::/32'));
        $this->expectException(ValidationException::class);
        IpBlockList::normalize('2a00:1450::/16');
    }

    public function test_an_admin_list_blocks_an_address_on_every_website(): void
    {
        [$siteA] = $this->siteWithClientToken();
        [$siteB, $tokenB] = $this->siteWithClientToken();
        $admin = User::factory()->create(['role' => 'super_admin', 'account_status' => 'active', 'email_verified_at' => now(), 'password' => Hash::make('password')]);
        $this->app['auth']->forgetGuards();
        $adminToken = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'password'])->assertOk()->json('token');

        $this->withToken($adminToken)->postJson('/api/v1/admin/blocked-ips', ['ip' => '203.0.113.77', 'note' => 'scanner'])
            ->assertOk()
            ->assertJsonPath('blocked_ips.0.ip', '203.0.113.77');

        $this->assertStringContainsString("-R '203.0.113.77'", $this->directives($siteA));
        $this->assertStringContainsString("-R '203.0.113.77'", $this->directives($siteB));

        // The client's own list is combined with it, and clients only see their own entries.
        $this->app['auth']->forgetGuards();
        $this->withToken($tokenB)->postJson("/api/v1/client/services/{$siteB->id}/website/blocked-ips", ['ip' => '203.0.113.88'])
            ->assertOk()
            ->assertJsonCount(1, 'blocked_ips');
        $this->assertStringContainsString("-R '203.0.113.88' || -R '203.0.113.77'", $this->directives($siteB));

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)->deleteJson('/api/v1/admin/blocked-ips', ['ip' => '203.0.113.77'])->assertOk()->assertJsonCount(0, 'blocked_ips');
        $this->assertStringNotContainsString('NAI-TALK-IPBLOCK', $this->directives($siteA));
        $this->assertStringContainsString("-R '203.0.113.88'", $this->directives($siteB));
    }

    public function test_clients_cannot_change_the_all_websites_list(): void
    {
        [, $token] = $this->siteWithClientToken();

        $this->withToken($token)->postJson('/api/v1/admin/blocked-ips', ['ip' => '203.0.113.5'])->assertForbidden();
    }
}
