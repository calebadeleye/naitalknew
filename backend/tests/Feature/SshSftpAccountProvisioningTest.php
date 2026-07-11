<?php

namespace Tests\Feature;

use App\Jobs\FtpAccountProvisioningActionJob;
use App\Jobs\ProvisionHostingServiceJob;
use App\Jobs\SyncFtpAccountsJob;
use App\Models\FtpAccountRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * PureFTPd is not reliably working on the production ISPConfig server, so
 * client-area self-service accounts are now provisioned as ISPConfig "shell
 * users" (real SSH + SFTP access, jailkit-chrooted to the website's own
 * document root) instead of FTP users. Existing 'ftp' typed records must
 * keep working through the legacy path — see FtpAccountProvisioningActionJob.
 */
class SshSftpAccountProvisioningTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    public function test_creating_an_account_through_the_client_endpoint_provisions_an_ssh_sftp_shell_user(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->postJson("/api/v1/client/services/{$service->id}/ftp-accounts", [
            'username' => 'sftpuser',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $account = FtpAccountRecord::query()->where('username', 'sftpuser')->firstOrFail();
        $this->assertSame('sftp', $account->access_type);
        $this->assertSame('active', $account->status);

        $call = collect($fake->calls)->last(fn ($call) => $call['method'] === 'shellUserAdd');
        $this->assertNotNull($call, 'shellUserAdd was never called.');
        $this->assertArrayHasKey('puser', $call['params']);
        $this->assertArrayHasKey('pgroup', $call['params']);
        $this->assertSame('/bin/bash', $call['params']['shell']);
        $this->assertSame('jailkit', $call['params']['chroot']);

        $this->assertFalse(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'ftpUserAdd'));
    }

    public function test_resetting_the_password_of_an_sftp_account_calls_shell_user_update(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $account = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => 'sftpuser',
            'access_type' => 'sftp',
            'status' => 'provisioning',
        ]);

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $account->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($fake);

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $account->id,
            'action' => 'reset_password',
            'payload' => ['password' => 'another-strong-password'],
        ])->handle($fake);

        $this->assertTrue(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'shellUserUpdate'));
    }

    public function test_disabling_and_deleting_an_sftp_account_use_the_shell_user_api(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $account = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => 'sftpuser',
            'access_type' => 'sftp',
            'status' => 'provisioning',
        ]);

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $account->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($fake);

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $account->id,
            'action' => 'disable',
        ])->handle($fake);

        $this->assertSame('disabled', $account->fresh()->status);
        $this->assertTrue(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'shellUserUpdate'));

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $account->id,
            'action' => 'delete',
        ])->handle($fake);

        $this->assertTrue(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'shellUserDelete'));
        $this->assertSoftDeleted('ftp_account_records', ['id' => $account->id]);
    }

    public function test_legacy_ftp_typed_records_still_use_the_ftp_user_api(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $account = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => 'legacyftpuser',
            'access_type' => 'ftp',
            'status' => 'provisioning',
        ]);

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $account->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($fake);

        $this->assertTrue(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'ftpUserAdd'));
        $this->assertFalse(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'shellUserAdd'));
    }

    public function test_sync_uses_shell_user_get_for_sftp_accounts_and_ftp_user_get_for_legacy_ones(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $sftpAccount = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => 'sftpuser',
            'access_type' => 'sftp',
            'status' => 'provisioning',
        ]);
        $ftpAccount = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => 'legacyftpuser',
            'access_type' => 'ftp',
            'status' => 'provisioning',
        ]);

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $sftpAccount->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($fake);
        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $ftpAccount->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($fake);

        SyncFtpAccountsJob::dispatch($service->id);

        $this->assertTrue(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'shellUserGet'));
        $this->assertTrue(collect($fake->calls)->contains(fn ($call) => $call['method'] === 'ftpUserGet'));
    }
}
