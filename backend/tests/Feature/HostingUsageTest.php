<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Models\HostingService;
use App\Notifications\HostingUsageWarning;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\FakeIspConfigClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class HostingUsageTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private const MB = 1_048_576;

    /** @return array{0: HostingService, 1: FakeIspConfigClient, 2: int, 3: int} service, fake, ISPConfig client id, website id */
    private function provisionedService(): array
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);
        $service->refresh();

        $mapping = $service->ispConfigServiceMappings()->with('clientMapping')->first();

        return [$service, $fake, (int) $mapping->clientMapping->ispconfig_client_id, (int) $mapping->ispconfig_website_id];
    }

    public function test_storage_counts_website_files_email_and_databases_against_the_package(): void
    {
        Notification::fake();
        [$service, $fake, $ispClient, $websiteId] = $this->provisionedService();
        $sid = $fake->login();

        $fake->setDiskUsageKb($websiteId, 2048 * 1024);
        $fake->mailUserAdd($sid, $ispClient, ['email' => "info@{$service->primary_domain}"]);
        $fake->setMailUsageBytes("info@{$service->primary_domain}", 1024 * self::MB);
        // Another domain's mailbox under the same ISPConfig client must not be counted here.
        $fake->mailUserAdd($sid, $ispClient, ['email' => 'someone@another-site.test']);
        $fake->setMailUsageBytes('someone@another-site.test', 4096 * self::MB);
        $fake->databasesDatabaseAdd($sid, $ispClient, ['database_name' => 'shop', 'parent_domain_id' => $websiteId]);
        $fake->setDatabaseUsageBytes('shop', 512 * self::MB);
        $fake->setTrafficThisMonthBytes($service->primary_domain, 5000 * self::MB);

        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        $snapshot = $service->latestUsageSnapshot();
        $this->assertSame(2048, $snapshot->web_used_mb);
        $this->assertSame(1024, $snapshot->mail_used_mb);
        $this->assertSame(512, $snapshot->database_used_mb);
        $this->assertSame(2048 + 1024 + 512, $snapshot->disk_used_mb);
        $this->assertSame(5000, $snapshot->bandwidth_used_mb);
    }

    public function test_the_client_is_warned_once_at_80_and_once_at_95_percent_of_storage(): void
    {
        Notification::fake();
        [$service, $fake, , $websiteId] = $this->provisionedService();
        $quotaMb = 10240;

        $fake->setDiskUsageKb($websiteId, (int) ($quotaMb * 0.85) * 1024);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        Notification::assertSentToTimes($service->client->user, HostingUsageWarning::class, 1);
        Notification::assertSentTo($service->client->user, HostingUsageWarning::class, fn (HostingUsageWarning $n) => $n->resource === 'storage' && $n->level === 80);

        $fake->setDiskUsageKb($websiteId, (int) ($quotaMb * 0.96) * 1024);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        Notification::assertSentToTimes($service->client->user, HostingUsageWarning::class, 2);
        Notification::assertSentTo($service->client->user, HostingUsageWarning::class, fn (HostingUsageWarning $n) => $n->level === 95);
        $this->assertDatabaseHas('notification_logs', ['hosting_service_id' => $service->id, 'template' => 'usage_storage_95_'.now()->format('Y-m'), 'status' => 'sent']);
    }

    public function test_the_client_is_warned_when_this_months_bandwidth_is_nearly_used(): void
    {
        Notification::fake();
        [$service, $fake] = $this->provisionedService();

        $fake->setTrafficThisMonthBytes($service->primary_domain, (int) (102400 * 0.97) * self::MB);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        Notification::assertSentTo($service->client->user, HostingUsageWarning::class, fn (HostingUsageWarning $n) => $n->resource === 'bandwidth' && $n->level === 95);
    }

    public function test_no_warning_below_80_percent_or_for_a_service_that_is_not_active(): void
    {
        Notification::fake();
        [$service, $fake, , $websiteId] = $this->provisionedService();

        $fake->setDiskUsageKb($websiteId, 5000 * 1024);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        $service->forceFill(['status' => 'suspended'])->save();
        $fake->setDiskUsageKb($websiteId, 10000 * 1024);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        Notification::assertNotSentTo($service->client->user, HostingUsageWarning::class);
    }

    public function test_one_failed_usage_call_keeps_that_part_at_its_last_known_value(): void
    {
        Notification::fake();
        [$service, $fake, $ispClient, $websiteId] = $this->provisionedService();
        $sid = $fake->login();
        $fake->mailUserAdd($sid, $ispClient, ['email' => "info@{$service->primary_domain}"]);
        $fake->setMailUsageBytes("info@{$service->primary_domain}", 300 * self::MB);
        $fake->setDiskUsageKb($websiteId, 100 * 1024);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        $fake->shouldFail('mailQuotaGetByUser', new IspConfigApiException('mail quota unavailable'));
        $fake->setDiskUsageKb($websiteId, 200 * 1024);
        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        $snapshot = $service->latestUsageSnapshot();
        $this->assertSame(200, $snapshot->web_used_mb);
        $this->assertSame(300, $snapshot->mail_used_mb);
        $this->assertSame(500, $snapshot->disk_used_mb);
        $this->assertDatabaseHas('provisioning_logs', ['hosting_service_id' => $service->id, 'action' => 'sync_usage_snapshot', 'status' => 'sync_failed']);
    }
}
