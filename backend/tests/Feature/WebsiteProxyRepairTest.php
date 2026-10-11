<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Jobs\RepairWebsiteProxiesJob;
use App\Models\HostingService;
use App\Notifications\WebsiteConnectionAlert;
use App\Services\Ispconfig\FakeIspConfigClient;
use App\Services\Ispconfig\ProxyPortProbe;
use App\Services\Ssl\FakeCertificateChecker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class WebsiteProxyRepairTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    /** Ports the pretend client app is "listening" on. */
    private array $listening = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->app->instance(\App\Services\Ssl\LiveCertificateChecker::class, new FakeCertificateChecker);

        $listening = &$this->listening;
        $this->app->instance(ProxyPortProbe::class, new class($listening) extends ProxyPortProbe
        {
            public function __construct(private array &$ports) {}

            public function isListening(int $port, float $timeoutSeconds = 1.5): bool
            {
                return in_array($port, $this->ports, true);
            }
        });
    }

    /** @return array{0: HostingService, 1: FakeIspConfigClient, 2: int, 3: string} */
    private function proxiedService(int $port = 3001): array
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);
        $service->refresh();

        $user = $service->client->user;
        $user->forceFill(['password' => Hash::make('secret-password')])->save();
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])->assertOk()->json('token');
        $this->listening = [$port];

        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/proxy", ['port' => $port])->assertOk();

        return [$service->fresh(), $fake, (int) $service->ispConfigServiceMappings()->value('ispconfig_website_id'), $token];
    }

    /** What happened to scholarjoint.com: ISPConfig's record loses the proxy rule. */
    private function loseTheProxyRule(FakeIspConfigClient $fake, int $websiteId): void
    {
        $fake->sitesWebDomainUpdate($fake->login(), 0, $websiteId, ['apache_directives' => '']);
    }

    public function test_setting_a_proxy_remembers_what_was_asked_for_and_reports_it_healthy(): void
    {
        [$service, , , $token] = $this->proxiedService(3001);

        $this->assertSame(3001, $service->website_proxy_desired_port);

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/website")
            ->assertOk()
            ->assertJsonPath('proxy.desired_port', 3001)
            ->assertJsonPath('proxy.health', 'ok');
    }

    public function test_the_dashboard_reports_a_missing_rule_and_still_remembers_the_port(): void
    {
        [$service, $fake, $websiteId, $token] = $this->proxiedService(3001);
        $this->loseTheProxyRule($fake, $websiteId);

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/website")
            ->assertOk()
            ->assertJsonPath('proxy.enabled', false)
            ->assertJsonPath('proxy.desired_port', 3001)
            ->assertJsonPath('proxy.health', 'rule_missing');

        // Reading used to overwrite the only record of the proxy — it must not any more.
        $this->assertSame(3001, $service->fresh()->website_proxy_desired_port);
    }

    public function test_the_client_can_repair_the_connection_from_the_dashboard(): void
    {
        [$service, $fake, $websiteId, $token] = $this->proxiedService(3001);
        $this->loseTheProxyRule($fake, $websiteId);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/proxy/repair")
            ->assertOk()
            ->assertJsonPath('proxy.enabled', true)
            ->assertJsonPath('proxy.health', 'ok');

        $this->assertStringContainsString('http://127.0.0.1:3001/', $fake->sitesWebDomainGet($fake->login(), $websiteId)['apache_directives']);
        $this->assertDatabaseHas('provisioning_logs', ['hosting_service_id' => $service->id, 'action' => 'repair_website_proxy', 'status' => 'completed']);
    }

    public function test_repair_is_refused_when_no_proxy_was_ever_set_up(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);
        $user = $service->client->user;
        $user->forceFill(['password' => Hash::make('secret-password')])->save();
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])->assertOk()->json('token');

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/website/proxy/repair")->assertStatus(422);
    }

    public function test_the_background_job_puts_a_vanished_rule_back_and_tells_the_client_once(): void
    {
        Notification::fake();
        [$service, $fake, $websiteId] = $this->proxiedService(3001);
        $this->loseTheProxyRule($fake, $websiteId);

        $this->app->call([new RepairWebsiteProxiesJob, 'handle']);

        $this->assertStringContainsString('http://127.0.0.1:3001/', $fake->sitesWebDomainGet($fake->login(), $websiteId)['apache_directives']);
        $this->assertSame('ok', $service->fresh()->website_proxy_health);
        $this->assertDatabaseHas('provisioning_logs', ['hosting_service_id' => $service->id, 'action' => 'proxy_auto_repaired']);
        Notification::assertSentTo($service->client->user, WebsiteConnectionAlert::class, fn ($n) => $n->kind === 'repaired' && $n->port === 3001);

        // Healthy now: a second run changes and sends nothing more.
        $this->app->call([new RepairWebsiteProxiesJob, 'handle']);
        Notification::assertSentToTimes($service->client->user, WebsiteConnectionAlert::class, 1);
    }

    public function test_a_healthy_site_is_left_completely_alone(): void
    {
        Notification::fake();
        [$service, $fake, $websiteId] = $this->proxiedService(3001);
        $callsBefore = count($fake->calls);

        $this->app->call([new RepairWebsiteProxiesJob, 'handle']);

        $writes = collect(array_slice($fake->calls, $callsBefore))->filter(fn ($call) => $call['method'] === 'sitesWebDomainUpdate');
        $this->assertCount(0, $writes);
        Notification::assertNothingSent();
        $this->assertSame('ok', $service->fresh()->website_proxy_health);
    }

    public function test_an_app_that_is_down_is_reported_not_repaired_and_emailed_at_most_daily(): void
    {
        Notification::fake();
        [$service, $fake, $websiteId] = $this->proxiedService(3001);
        $this->listening = [];

        $this->app->call([new RepairWebsiteProxiesJob, 'handle']);
        $this->app->call([new RepairWebsiteProxiesJob, 'handle']);

        $this->assertSame('app_down', $service->fresh()->website_proxy_health);
        Notification::assertSentToTimes($service->client->user, WebsiteConnectionAlert::class, 1);
        Notification::assertSentTo($service->client->user, WebsiteConnectionAlert::class, fn ($n) => $n->kind === 'app_down');
        $this->assertDatabaseMissing('provisioning_logs', ['hosting_service_id' => $service->id, 'action' => 'proxy_auto_repaired']);
    }

    public function test_a_suspended_site_is_not_touched_by_the_repair_job(): void
    {
        Notification::fake();
        [$service, $fake, $websiteId] = $this->proxiedService(3001);
        $this->loseTheProxyRule($fake, $websiteId);
        $service->forceFill(['status' => 'suspended'])->save();

        $this->app->call([new RepairWebsiteProxiesJob, 'handle']);

        $this->assertSame('', (string) $fake->sitesWebDomainGet($fake->login(), $websiteId)['apache_directives']);
    }

    public function test_turning_the_proxy_off_stops_all_watching(): void
    {
        Notification::fake();
        [$service, $fake, $websiteId, $token] = $this->proxiedService(3001);

        $this->withToken($token)->putJson("/api/v1/client/services/{$service->id}/website/proxy", ['port' => null])->assertOk();
        $this->assertNull($service->fresh()->website_proxy_desired_port);

        $this->app->call([new RepairWebsiteProxiesJob, 'handle']);
        $this->assertSame('', trim((string) $fake->sitesWebDomainGet($fake->login(), $websiteId)['apache_directives']));
    }
}
