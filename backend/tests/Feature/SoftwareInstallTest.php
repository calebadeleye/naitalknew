<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Models\SoftwareInstallation;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\Concerns\FakesSshCommandRunner;
use Tests\TestCase;

class SoftwareInstallTest extends TestCase
{
    use CreatesDomainFixtures, CreatesHostingFixtures, FakesIspConfig, FakesSshCommandRunner, RefreshDatabase;

    private function provisionedService($fake, array $serviceAttributes = []): HostingService
    {
        $service = $this->createProvisionableHostingService(serviceAttributes: $serviceAttributes);
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

    public function test_the_catalog_lists_naipay(): void
    {
        $fake = $this->fakeIspConfig();
        $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/software")
            ->assertOk()
            ->assertJsonPath('catalog.0.slug', 'naipay')
            ->assertJsonPath('installations', []);
    }

    public function test_a_full_install_succeeds_and_the_admin_password_is_shown_exactly_once(): void
    {
        $fake = $this->fakeIspConfig();
        $ssh = $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(202);

        $installation = SoftwareInstallation::query()->firstOrFail();
        $this->assertSame('active', $installation->status);
        $this->assertSame('banking.'.$service->primary_domain, $installation->subdomain);
        $this->assertNotNull($installation->admin_password_shown_once);
        $this->assertNotNull($installation->redis_db_index);
        $this->assertNotNull($installation->node_port);

        // ISPConfig actually got asked to create a database, a new website
        // and a shell account scoped to it.
        $methods = collect($fake->calls)->pluck('method');
        $this->assertTrue($methods->contains('databasesDatabaseUserAdd'));
        $this->assertTrue($methods->contains('databasesDatabaseAdd'));
        $this->assertTrue($methods->contains('sitesWebDomainAdd'));
        $this->assertTrue($methods->contains('shellUserAdd'));

        // The build actually ran the real steps against the build account.
        $commands = collect($ssh->executedCommands)->pluck('command');
        $this->assertTrue($commands->contains(fn ($c) => str_contains($c, 'git clone')));
        $this->assertTrue($commands->contains(fn ($c) => str_contains($c, 'composer install')));
        $this->assertTrue($commands->contains(fn ($c) => str_contains($c, 'npm ci')));
        $this->assertTrue($commands->contains(fn ($c) => str_contains($c, 'artisan migrate')));
        $this->assertTrue($commands->contains(fn ($c) => str_contains($c, 'artisan db:seed')));
        $this->assertTrue($commands->contains(fn ($c) => str_contains($c, 'pm2 start')));

        // The hosting DB is MariaDB-compatible: the app must not be left on
        // Laravel's MySQL-8-only default collation ("[1273] Unknown collation").
        $backendEnv = collect($ssh->writtenFiles)->first(fn ($contents, $path) => str_ends_with($path, 'backend/api/.env'));
        $this->assertStringContainsString('DB_COLLATION=utf8mb4_unicode_ci', $backendEnv);
        $this->assertStringContainsString('DB_CHARSET=utf8mb4', $backendEnv);
        $this->assertStringContainsString('REDIS_CLIENT=predis', $backendEnv);

        $this->app['auth']->forgetGuards();
        $response =$this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/software/{$installation->id}")
            ->assertOk();
        $this->assertNotNull($response->json('admin_password'));

        $this->app['auth']->forgetGuards();
        $second = $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/software/{$installation->id}")
            ->assertOk();
        $this->assertNull($second->json('admin_password'));
    }

    public function test_a_second_install_of_the_same_app_for_the_same_service_is_rejected_while_one_is_active(): void
    {
        $fake = $this->fakeIspConfig();
        $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(202);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking-two',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(422);
    }

    public function test_a_mid_install_failure_rolls_back_the_database_and_website_it_already_created(): void
    {
        $fake = $this->fakeIspConfig();
        $ssh = $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        // Let the database and the new subdomain get created, then fail the
        // very next ISPConfig call (creating the shell account) so both of
        // those already-created resources need to be rolled back.
        $fake->shouldFail('shellUserAdd', new IspConfigApiException('shell user creation failed'));

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(202);

        $installation = SoftwareInstallation::query()->firstOrFail();
        $this->assertSame('failed', $installation->status);
        $this->assertNotNull($installation->error_message);
        $this->assertNull($installation->admin_password_shown_once);

        $methods = collect($fake->calls)->pluck('method');
        $this->assertTrue($methods->contains('sitesWebDomainDelete'), 'the newly created website should have been rolled back');
        $this->assertTrue($methods->contains('databasesDatabaseDelete'), 'the newly created database should have been rolled back');
        $this->assertTrue($methods->contains('databasesDatabaseUserDelete'), 'the newly created database user should have been rolled back');
    }

    public function test_a_failed_shell_command_stops_the_install_and_marks_it_failed(): void
    {
        $fake = $this->fakeIspConfig();
        $ssh = $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $ssh->failOn('composer install', 'could not resolve dependencies');

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(202);

        $installation = SoftwareInstallation::query()->firstOrFail();
        $this->assertSame('failed', $installation->status);
        $this->assertStringContainsString('composer install', $installation->error_message);

        // sitesWebDomainAdd appears exactly once already — from provisioning
        // the client's own base hosting service in provisionedService(),
        // before the install even started. The install itself never got as
        // far as provisioning its own new subdomain, so that count must not
        // have grown, and there is nothing else for rollback to have needed
        // to undo.
        $methods = collect($fake->calls)->pluck('method');
        $this->assertSame(1, $methods->filter(fn ($method) => $method === 'sitesWebDomainAdd')->count());
        $this->assertFalse($methods->contains('databasesDatabaseAdd'));
    }

    public function test_migrations_wait_for_ispconfig_to_create_the_database_login(): void
    {
        Sleep::fake();
        $fake = $this->fakeIspConfig();
        $ssh = $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $refused = "SQLSTATE[HY000] [1045] Access denied for user 'sw1_abc'@'localhost' (using password: YES)";
        $ssh->respondOnce('php artisan migrate', 1, $refused);
        $ssh->respondOnce('php artisan migrate', 1, $refused);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(202);

        $this->assertSame('active', SoftwareInstallation::query()->firstOrFail()->status);
        $migrateRuns = collect($ssh->executedCommands)->filter(fn ($run) => $run['command'] === 'php artisan migrate --force');
        $this->assertCount(3, $migrateRuns);
        Sleep::assertSleptTimes(2);
    }

    public function test_a_migration_error_that_is_not_a_refused_login_fails_without_waiting(): void
    {
        Sleep::fake();
        $fake = $this->fakeIspConfig();
        $ssh = $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $ssh->failOn('php artisan migrate', 'SQLSTATE[42S01]: Base table or view already exists');

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(202);

        $installation = SoftwareInstallation::query()->firstOrFail();
        $this->assertSame('failed', $installation->status);
        $this->assertStringContainsString('Base table or view already exists', $installation->error_message);
        Sleep::assertNeverSlept();
    }

    public function test_progress_percent_moves_within_a_long_step_and_never_reaches_100_until_active(): void
    {
        $fake = $this->fakeIspConfig();
        $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $installation = SoftwareInstallation::query()->create([
            'hosting_service_id' => $service->id,
            'catalog_slug' => 'naipay',
            'status' => 'building',
            'progress_step' => 'building_frontend',
            'subdomain' => 'banking.'.$service->primary_domain,
            'admin_email' => 'owner@example.test',
        ]);

        $percentAt = function (int $secondsIntoStep) use ($installation, $service, $token): array {
            $this->app['auth']->forgetGuards();
            SoftwareInstallation::query()->whereKey($installation->id)->update(['updated_at' => now()->subSeconds($secondsIntoStep)]);

            return $this->withToken($token)
                ->getJson("/api/v1/client/services/{$service->id}/software/{$installation->id}")
                ->assertOk()->json();
        };

        $start = $percentAt(0);
        $middle = $percentAt(210);
        $overrun = $percentAt(99999);

        $this->assertSame(16, $start['progress_step_total']);
        $this->assertSame(11, $start['progress_step_number']);
        $this->assertGreaterThan(0, $start['progress_percent']);
        $this->assertGreaterThan($start['progress_percent'], $middle['progress_percent']);
        $this->assertGreaterThan($middle['progress_percent'], $overrun['progress_percent']);
        $this->assertLessThan(100, $overrun['progress_percent']);
        $this->assertNotNull($overrun['started_at']);

        SoftwareInstallation::query()->whereKey($installation->id)->update(['status' => 'active']);
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/software/{$installation->id}")
            ->assertOk()->assertJsonPath('progress_percent', 100);
    }

    public function test_a_failed_install_can_be_retried_on_the_same_or_a_new_subdomain(): void
    {
        $fake = $this->fakeIspConfig();
        $ssh = $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);
        $url = "/api/v1/client/services/{$service->id}/software/install";
        $payload = ['catalog_slug' => 'naipay', 'subdomain' => 'banking', 'admin_email' => 'owner@example.test'];

        $ssh->failOn('composer install', 'boom');
        $this->withToken($token)->postJson($url, $payload)->assertStatus(202);
        $this->assertSame('failed', SoftwareInstallation::query()->firstOrFail()->status);

        // Same subdomain again, now that the failing command works.
        $ssh->respond('composer install', 0);
        $this->withToken($token)->postJson($url, $payload)->assertStatus(202);

        $this->assertSame(1, SoftwareInstallation::query()->count());
        $this->assertSame('active', SoftwareInstallation::query()->firstOrFail()->status);
    }

    public function test_a_subdomain_that_is_already_taken_is_rejected(): void
    {
        $fake = $this->fakeIspConfig();
        $this->fakeSshCommandRunner();
        $sharedDomain = 'shared-'.Str::random(6).'.test';
        $service = $this->provisionedService($fake, ['primary_domain' => $sharedDomain]);
        $token = $this->clientToken($service);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertStatus(202);

        // Two different clients whose primary domains happen to collide
        // (e.g. re-registered/imported domains) must not be able to both
        // claim "banking.<that same domain>".
        $this->app['auth']->forgetGuards();
        $serviceTwo = $this->provisionedService($fake, ['primary_domain' => $sharedDomain]);
        $tokenTwo = $this->clientToken($serviceTwo);

        $this->withToken($tokenTwo)->postJson("/api/v1/client/services/{$serviceTwo->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'someone-else@example.test',
        ])->assertStatus(422);
    }

    public function test_a_client_cannot_install_software_on_another_clients_service(): void
    {
        $fake = $this->fakeIspConfig();
        $this->fakeSshCommandRunner();
        $service = $this->provisionedService($fake);
        ['token' => $otherToken] = $this->registerVerifiedDomainClient('not-the-owner@example.test');

        $this->withToken($otherToken)->postJson("/api/v1/client/services/{$service->id}/software/install", [
            'catalog_slug' => 'naipay',
            'subdomain' => 'banking',
            'admin_email' => 'owner@example.test',
        ])->assertForbidden();
    }
}
