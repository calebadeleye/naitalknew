<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Jobs\SyncIspConfigHostingServicesJob;
use App\Models\HostingService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class WebsiteSettingsTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private function provisionedService($fake): HostingService
    {
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    private function clientToken(HostingService $service): string
    {
        $user = $service->client->user;
        $user->forceFill(['password' => Hash::make('secret-password')])->save();

        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])
            ->assertOk()->json('token');
    }

    public function test_website_settings_start_off_right_after_provisioning_and_the_dashboard_flags_ssl(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        // The site's HTTPS port is already open at provisioning time (matches
        // real ISPConfig sites), but with no certificate on file yet — that
        // "active" flag, not "enabled", is what the client-facing banner uses.
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/website")
            ->assertOk()
            ->assertJsonPath('php.enabled', false)
            ->assertJsonPath('ssl.mode', null)
            ->assertJsonPath('ssl.active', false)
            ->assertJsonPath('proxy.enabled', false);

        $this->withToken($token)->getJson('/api/v1/client/dashboard')
            ->assertOk()
            ->assertJsonPath('services.0.needs_ssl_setup', true);
    }

    public function test_client_can_turn_php_on_and_off_and_it_is_reflected_in_ispconfig(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);
        $websiteId = (int) $service->ispConfigServiceMappings()->first()->ispconfig_website_id;

        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/php", ['enabled' => true])
            ->assertOk()->assertJsonPath('php.enabled', true);

        $sid = $fake->login();
        $this->assertSame('php-fpm', $fake->sitesWebDomainGet($sid, $websiteId)['php']);
        $this->assertTrue($service->fresh()->website_php_enabled);

        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/php", ['enabled' => false])
            ->assertOk()->assertJsonPath('php.enabled', false);
        $this->assertSame('no', $fake->sitesWebDomainGet($sid, $websiteId)['php']);
    }

    public function test_client_can_request_free_ssl_and_activation_shows_once_ispconfig_has_issued_it(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);
        $websiteId = (int) $service->ispConfigServiceMappings()->first()->ispconfig_website_id;

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/ssl/free")
            ->assertOk()
            ->assertJsonPath('ssl.enabled', true)
            ->assertJsonPath('ssl.mode', 'free')
            ->assertJsonPath('ssl.active', false);

        $this->assertFalse($service->fresh()->website_ssl_active);

        // ISPConfig issues the certificate asynchronously — simulate that here.
        $sid = $fake->login();
        $fake->sitesWebDomainUpdate($sid, 1, $websiteId, ['ssl_cert' => '-----BEGIN CERTIFICATE-----FAKE-----END CERTIFICATE-----']);

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/website")
            ->assertOk()
            ->assertJsonPath('ssl.mode', 'free')
            ->assertJsonPath('ssl.active', true);
        $this->assertTrue($service->fresh()->website_ssl_active);

        $this->withToken($token)->getJson('/api/v1/client/dashboard')->assertJsonPath('services.0.needs_ssl_setup', false);
    }

    public function test_client_can_install_a_matching_custom_certificate_immediately(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);
        [$cert, $key] = $this->generateSelfSignedPair();

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/ssl/custom", [
            'certificate' => $cert,
            'private_key' => $key,
        ])->assertOk()
            ->assertJsonPath('ssl.mode', 'custom')
            ->assertJsonPath('ssl.active', true);

        $this->assertSame('custom', $service->fresh()->website_ssl_mode);
        $this->assertTrue($service->fresh()->website_ssl_active);
    }

    public function test_custom_ssl_is_rejected_when_the_key_does_not_match_the_certificate(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);
        [$cert] = $this->generateSelfSignedPair();
        [, $otherKey] = $this->generateSelfSignedPair();

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/ssl/custom", [
            'certificate' => $cert,
            'private_key' => $otherKey,
        ])->assertStatus(422)->assertJsonValidationErrors('private_key');

        $this->assertFalse($service->fresh()->website_ssl_active);
    }

    public function test_client_can_turn_ssl_off(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/ssl/free")->assertOk();
        $this->withToken($token)->deleteJson("/api/v1/client/services/{$service->id}/website/ssl")
            ->assertOk()->assertJsonPath('ssl.enabled', false)->assertJsonPath('ssl.mode', null);
    }

    public function test_client_can_set_and_remove_a_reverse_proxy_without_touching_other_apache_directives(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);
        $websiteId = (int) $service->ispConfigServiceMappings()->first()->ispconfig_website_id;

        $sid = $fake->login();
        $fake->sitesWebDomainUpdate($sid, 1, $websiteId, ['apache_directives' => 'RewriteEngine On']);

        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/proxy", ['port' => 3000])
            ->assertOk()
            ->assertJsonPath('proxy.enabled', true)
            ->assertJsonPath('proxy.port', 3000);

        $directives = $fake->sitesWebDomainGet($sid, $websiteId)['apache_directives'];
        $this->assertStringContainsString('RewriteEngine On', $directives);
        $this->assertStringContainsString('http://127.0.0.1:3000/', $directives);
        $this->assertTrue($service->fresh()->website_reverse_proxy_enabled);
        $this->assertSame(3000, $service->fresh()->website_reverse_proxy_port);

        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/proxy", ['port' => null])
            ->assertOk()->assertJsonPath('proxy.enabled', false);

        $directivesAfter = $fake->sitesWebDomainGet($sid, $websiteId)['apache_directives'];
        $this->assertStringContainsString('RewriteEngine On', $directivesAfter);
        $this->assertStringNotContainsString('ProxyPass', $directivesAfter);
        $this->assertFalse($service->fresh()->website_reverse_proxy_enabled);
    }

    public function test_a_proxy_port_already_used_by_another_website_is_rejected(): void
    {
        $fake = $this->fakeIspConfig();
        $serviceA = $this->provisionedService($fake);
        $serviceB = $this->provisionedService($fake);
        $tokenA = $this->clientToken($serviceA);
        $tokenB = $this->clientToken($serviceB);

        $this->withToken($tokenA)->putJson("/api/v1/client/services/{$serviceA->id}/website/proxy", ['port' => 4000])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($tokenB)->putJson("/api/v1/client/services/{$serviceB->id}/website/proxy", ['port' => 4000])
            ->assertStatus(422)->assertJsonValidationErrors('port');
    }

    public function test_client_cannot_manage_another_clients_website(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $intruder = User::factory()->create(['role' => 'client', 'account_status' => 'active', 'email_verified_at' => now(), 'password' => Hash::make('secret-password')]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $intruder->email, 'password' => 'secret-password'])->assertOk()->json('token');

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/website")->assertForbidden();
        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/php", ['enabled' => true])->assertForbidden();
    }

    public function test_the_periodic_sync_job_refreshes_cached_settings_without_the_client_visiting_the_page(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $websiteId = (int) $service->ispConfigServiceMappings()->first()->ispconfig_website_id;

        $sid = $fake->login();
        $fake->sitesWebDomainUpdate($sid, 1, $websiteId, [
            'ssl' => 'y',
            'ssl_letsencrypt' => 'y',
            'ssl_cert' => '-----BEGIN CERTIFICATE-----FAKE-----END CERTIFICATE-----',
            'php' => 'php-fpm',
        ]);

        SyncIspConfigHostingServicesJob::dispatchSync($service->id);

        $service->refresh();
        $this->assertTrue($service->website_ssl_active);
        $this->assertSame('free', $service->website_ssl_mode);
        $this->assertTrue($service->website_php_enabled);
    }

    /**
     * @return array{0: string, 1: string} [certificate PEM, private key PEM]
     */
    private function generateSelfSignedPair(): array
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $csr = openssl_csr_new(['commonName' => 'example.test'], $key);
        $cert = openssl_csr_sign($csr, null, $key, 365);

        openssl_x509_export($cert, $certPem);
        openssl_pkey_export($key, $keyPem);

        return [$certPem, $keyPem];
    }
}
