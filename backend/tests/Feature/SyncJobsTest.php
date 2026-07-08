<?php

namespace Tests\Feature;

use App\Jobs\DatabaseProvisioningActionJob;
use App\Jobs\DetectOrphanedIspConfigClientsJob;
use App\Jobs\FtpAccountProvisioningActionJob;
use App\Jobs\MailboxProvisioningActionJob;
use App\Jobs\ProvisionHostingServiceJob;
use App\Jobs\SyncDatabasesJob;
use App\Jobs\SyncFtpAccountsJob;
use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Jobs\SyncIspConfigClientMappingsJob;
use App\Jobs\SyncIspConfigHostingServicesJob;
use App\Jobs\SyncMailboxesJob;
use App\Models\DatabaseRecord;
use App\Models\FtpAccountRecord;
use App\Models\MailboxRecord;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class SyncJobsTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    public function test_hosting_usage_snapshot_sync_appends_a_snapshot_per_provisioned_service(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $before = $service->usageSnapshots()->count();

        SyncHostingUsageSnapshotJob::dispatch();

        $this->assertGreaterThan($before, $service->usageSnapshots()->count());
    }

    public function test_client_mapping_sync_flags_a_mapping_whose_remote_client_disappeared(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $mapping = $service->client->ispConfigClientMappings()->first();
        $this->assertNotNull($mapping->ispconfig_client_id);

        $fake->shouldFail('clientGet', new IspConfigApiException('ISPConfig client lookup failed'));

        SyncIspConfigClientMappingsJob::dispatch();

        $this->assertDatabaseHas('provisioning_logs', [
            'action' => 'sync_client_mapping',
            'status' => 'sync_failed',
        ]);
    }

    public function test_hosting_service_technical_sync_does_not_abort_on_one_bad_mapping(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        $second = $this->createProvisionableHostingService([], ['client_id' => $service->client_id]);
        ProvisionHostingServiceJob::dispatch($service->id);
        ProvisionHostingServiceJob::dispatch($second->id);

        $fake->shouldFail('sitesWebDomainGet', new IspConfigApiException('boom'));

        SyncIspConfigHostingServicesJob::dispatch();

        // One mapping's Get call fails; the job must still process the other mapping.
        $this->assertDatabaseHas('provisioning_logs', ['action' => 'sync_hosting_service', 'status' => 'sync_failed']);
    }

    public function test_orphaned_client_detection_flags_remote_clients_with_no_local_mapping(): void
    {
        $fake = $this->fakeIspConfig();
        // A remote client that exists in ISPConfig but was never mapped locally.
        $sessionId = $fake->login();
        $fake->clientAdd($sessionId, 0, ['company_name' => 'Orphan Co']);
        $fake->logout($sessionId);

        DetectOrphanedIspConfigClientsJob::dispatch();

        $this->assertDatabaseHas('provisioning_logs', ['action' => 'detect_orphaned_ispconfig_clients', 'status' => 'review_required']);
    }

    public function test_mailbox_database_and_ftp_sync_mark_missing_remote_records(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $mailbox = MailboxRecord::query()->create([
            'hosting_service_id' => $service->id,
            'ispconfig_mailbox_id' => '999999',
            'email_address' => 'ghost@example.test',
            'status' => 'active',
        ]);

        $database = DatabaseRecord::query()->create([
            'hosting_service_id' => $service->id,
            'ispconfig_database_id' => '999999',
            'database_name' => 'ghost_db',
            'username' => 'ghost_user',
            'status' => 'active',
        ]);

        $ftpAccount = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'ispconfig_ftp_user_id' => '999999',
            'username' => 'ghost_ftp',
            'status' => 'active',
        ]);

        SyncMailboxesJob::dispatch();
        SyncDatabasesJob::dispatch();
        SyncFtpAccountsJob::dispatch();

        $this->assertSame('missing_remote', $mailbox->fresh()->status);
        $this->assertSame('missing_remote', $database->fresh()->status);
        $this->assertSame('missing_remote', $ftpAccount->fresh()->status);
    }

    public function test_creating_a_mailbox_database_or_ftp_account_dispatches_a_usage_snapshot_sync(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $client = $this->app->make(IspConfigClient::class);

        $mailbox = MailboxRecord::query()->create([
            'hosting_service_id' => $service->id,
            'email_address' => 'sync-check@'.$service->primary_domain,
            'status' => 'provisioning',
        ]);

        Queue::fake([SyncHostingUsageSnapshotJob::class]);
        $this->app->make(MailboxProvisioningActionJob::class, [
            'mailboxRecordId' => $mailbox->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($client);
        Queue::assertPushed(SyncHostingUsageSnapshotJob::class, fn ($job) => $job->hostingServiceId === $service->id);

        $database = DatabaseRecord::query()->create([
            'hosting_service_id' => $service->id,
            'database_name' => 'sync_check_db',
            'username' => 'sync_check_user',
            'status' => 'provisioning',
        ]);

        Queue::fake([SyncHostingUsageSnapshotJob::class]);
        $this->app->make(DatabaseProvisioningActionJob::class, [
            'databaseRecordId' => $database->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($client);
        Queue::assertPushed(SyncHostingUsageSnapshotJob::class, fn ($job) => $job->hostingServiceId === $service->id);

        $ftpAccount = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => 'sync_check_ftp',
            'status' => 'provisioning',
        ]);

        Queue::fake([SyncHostingUsageSnapshotJob::class]);
        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $ftpAccount->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($client);
        Queue::assertPushed(SyncHostingUsageSnapshotJob::class, fn ($job) => $job->hostingServiceId === $service->id);
    }

    public function test_creating_an_ftp_account_sends_server_id_to_ispconfig(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        $ftpAccount = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => 'server_id_check_ftp',
            'status' => 'provisioning',
        ]);

        $this->app->make(FtpAccountProvisioningActionJob::class, [
            'ftpAccountRecordId' => $ftpAccount->id,
            'action' => 'create',
            'payload' => ['password' => 'a-strong-password'],
        ])->handle($fake);

        $call = collect($fake->calls)->last(fn ($call) => $call['method'] === 'ftpUserAdd');

        $this->assertNotNull($call, 'ftpUserAdd was never called.');
        $this->assertArrayHasKey('server_id', $call['params']);
        $this->assertNotSame(0, $call['params']['server_id']);
        $this->assertSame('active', $ftpAccount->fresh()->status);
    }
}
