<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Services\Ssl\FakeCertificateChecker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class AdminSslCertificateOverviewTest extends TestCase
{
    use CreatesDomainFixtures, CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private function fakeCertificateChecker(): FakeCertificateChecker
    {
        $checker = new FakeCertificateChecker;
        $this->app->instance(\App\Services\Ssl\LiveCertificateChecker::class, $checker);

        return $checker;
    }

    private function provisionedService($fake, string $domain): HostingService
    {
        $service = $this->createProvisionableHostingService([], ['primary_domain' => $domain]);
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    public function test_overview_reports_active_expiring_and_not_active_sites_sorted_by_urgency(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $checker = $this->fakeCertificateChecker();
        $admin = $this->domainAdminToken();

        $healthy = $this->provisionedService($fake, 'healthy.example.test');
        $checker->markActive($healthy->primary_domain, now()->addDays(60));
        app(\App\Services\Ispconfig\WebsiteSettingsService::class)->read($healthy);

        $this->app['auth']->forgetGuards();
        $expiringSoon = $this->provisionedService($fake, 'expiring-soon.example.test');
        $checker->markActive($expiringSoon->primary_domain, now()->addDays(5));
        app(\App\Services\Ispconfig\WebsiteSettingsService::class)->read($expiringSoon);

        $this->app['auth']->forgetGuards();
        $expired = $this->provisionedService($fake, 'expired.example.test');
        $checker->markExpired($expired->primary_domain, now()->subDays(3));
        app(\App\Services\Ispconfig\WebsiteSettingsService::class)->read($expired);

        $this->app['auth']->forgetGuards();
        $neverChecked = $this->provisionedService($fake, 'never-checked.example.test');

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($admin)->getJson('/api/v1/admin/ssl-certificates')->assertOk();
        $rows = collect($response->json('data'))->keyBy('domain');

        $this->assertSame('active', $rows['healthy.example.test']['status']);
        $this->assertFalse($rows['healthy.example.test']['days_remaining'] <= 14);

        $this->assertSame('expiring_soon', $rows['expiring-soon.example.test']['status']);
        $this->assertTrue($rows['expiring-soon.example.test']['ssl_active']);
        $this->assertLessThanOrEqual(14, $rows['expiring-soon.example.test']['days_remaining']);

        $this->assertSame('not_active', $rows['expired.example.test']['status']);
        $this->assertFalse($rows['expired.example.test']['ssl_active']);

        $this->assertSame('unchecked', $rows['never-checked.example.test']['status']);
        $this->assertNull($rows['never-checked.example.test']['days_remaining']);

        // Most urgent first: expired/unchecked and expiring-soon ahead of healthy.
        $order = collect($response->json('data'))->pluck('domain')->values();
        $this->assertLessThan($order->search('healthy.example.test'), $order->search('expiring-soon.example.test'));
    }

    public function test_only_admins_can_view_the_ssl_overview(): void
    {
        $this->seed();
        ['token' => $token] = $this->registerVerifiedDomainClient('ssl-overview-client@example.test');

        $this->withToken($token)->getJson('/api/v1/admin/ssl-certificates')->assertForbidden();
    }

    public function test_refresh_queues_a_full_resync_and_returns_the_current_overview(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $this->fakeCertificateChecker();
        $admin = $this->domainAdminToken();
        $this->provisionedService($fake, 'refresh-me.example.test');

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($admin)->postJson('/api/v1/admin/ssl-certificates/refresh')->assertStatus(202);
        $this->assertContains('refresh-me.example.test', collect($response->json('data'))->pluck('domain'));
    }

    public function test_a_service_with_no_ispconfig_mapping_yet_is_excluded(): void
    {
        $this->seed();
        $admin = $this->domainAdminToken();
        // Never provisioned — no ISPConfig website mapping — must not appear,
        // even though it otherwise matches (status active).
        $unprovisioned = $this->createProvisionableHostingService([], ['primary_domain' => 'never-provisioned.example.test', 'status' => 'active']);

        $response = $this->withToken($admin)->getJson('/api/v1/admin/ssl-certificates')->assertOk();

        $this->assertNotContains('never-provisioned.example.test', collect($response->json('data'))->pluck('domain'));
    }
}
