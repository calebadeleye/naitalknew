<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\FtpAccountRecord;
use App\Models\HostingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class AdminFtpAccountTest extends TestCase
{
    use CreatesDomainFixtures, CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private function provisionedService($fake): HostingService
    {
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    public function test_admin_can_create_an_ssh_sftp_account_and_sees_the_password_once(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);

        $response = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts", [
            'username' => 'chaccic-deploy',
        ])->assertCreated();

        $this->assertNotEmpty($response->json('password'));
        $this->assertSame('chaccic-deploy', $response->json('data.username'));
        $this->assertSame('active', $response->json('data.status'));

        $record = FtpAccountRecord::where('hosting_service_id', $service->id)->firstOrFail();
        $this->assertSame('admin_created', $record->source);
        $this->assertSame('sftp', $record->access_type);
        $this->assertNotNull($record->ispconfig_ftp_user_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'create_ssh_sftp_account', 'hosting_service_id' => $service->id]);

        // The real account is a jailkit shell user in ISPConfig, chrooted to the site's own document root.
        $sid = $fake->login();
        $remote = $fake->shellUserList($sid, ['username' => 'chaccic-deploy'])[0] ?? null;
        $this->assertNotNull($remote);
        $this->assertSame('jailkit', $remote['chroot']);
    }

    public function test_admin_can_supply_their_own_password(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);

        $response = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts", [
            'username' => 'chaccic-deploy',
            'password' => 'a-chosen-password',
        ])->assertCreated();

        $this->assertSame('a-chosen-password', $response->json('password'));
    }

    public function test_a_duplicate_username_on_the_same_service_is_rejected(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);

        $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts", ['username' => 'dup'])->assertCreated();
        $this->app['auth']->forgetGuards();
        $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts", ['username' => 'dup'])->assertStatus(422);
    }

    public function test_admin_can_reset_the_password_and_receives_the_new_one(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);
        $created = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts", ['username' => 'reset-me'])->json('data');

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts/{$created['id']}/reset-password")
            ->assertOk();

        $this->assertNotEmpty($response->json('password'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'reset_ssh_sftp_password']);
    }

    public function test_admin_can_disable_and_delete_the_account(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);
        $created = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts", ['username' => 'temp-account'])->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts/{$created['id']}/disable")
            ->assertOk()->assertJsonPath('data.status', 'disabled');

        $this->app['auth']->forgetGuards();
        $this->withToken($admin)->deleteJson("/api/v1/admin/services/{$service->id}/ftp-accounts/{$created['id']}")->assertOk();

        $this->assertSoftDeleted('ftp_account_records', ['id' => $created['id']]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'delete_ssh_sftp_account']);
    }

    public function test_the_list_endpoint_returns_accounts_for_that_service_only(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $serviceA = $this->provisionedService($fake);
        $this->app['auth']->forgetGuards();
        $serviceB = $this->provisionedService($fake);

        $this->withToken($admin)->postJson("/api/v1/admin/services/{$serviceA->id}/ftp-accounts", ['username' => 'a-account'])->assertCreated();
        $this->app['auth']->forgetGuards();
        $this->withToken($admin)->postJson("/api/v1/admin/services/{$serviceB->id}/ftp-accounts", ['username' => 'b-account'])->assertCreated();

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($admin)->getJson("/api/v1/admin/services/{$serviceA->id}/ftp-accounts")->assertOk();
        $usernames = collect($response->json('data'))->pluck('username');

        $this->assertTrue($usernames->contains('a-account'));
        $this->assertFalse($usernames->contains('b-account'));
    }

    public function test_only_admins_can_manage_ssh_sftp_accounts(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        ['token' => $token] = $this->registerVerifiedDomainClient('not-an-admin@example.test');

        $this->withToken($token)->postJson("/api/v1/admin/services/{$service->id}/ftp-accounts", ['username' => 'nope'])->assertForbidden();
    }
}
