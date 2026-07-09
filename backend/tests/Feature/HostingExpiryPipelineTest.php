<?php

namespace Tests\Feature;

use App\Jobs\CheckExpiredHostingServicesJob;
use App\Jobs\DeleteExpiredIspconfigWebsiteJob;
use App\Jobs\SendHostingExpiryReminderJob;
use App\Jobs\SuspendExpiredHostingJob;
use App\Models\Client;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\NotificationLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * All fixtures are factory-created test clients/services, never real
 * ISPConfig-imported production data.
 */
class HostingExpiryPipelineTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    public function test_check_expired_hosting_services_job_marks_expired_and_starts_grace_period(): void
    {
        $service = $this->createProvisionableHostingService([], [
            'status' => 'active',
            'renews_at' => now()->subDays(2)->toDateString(),
        ]);

        (new CheckExpiredHostingServicesJob())->handle($this->app->make(\App\Services\Notifications\ClientNotifier::class));

        $service->refresh();
        $this->assertSame('expired', $service->status);
        $this->assertNotNull($service->expired_at);
        $this->assertSame(
            now()->addDays((int) config('hosting_lifecycle.grace_period_days'))->toDateString(),
            $service->grace_period_ends_at->toDateString(),
        );

        $this->assertDatabaseHas('audit_logs', ['action' => 'hosting_expired', 'hosting_service_id' => $service->id]);
        $this->assertDatabaseHas('notification_logs', ['hosting_service_id' => $service->id, 'template' => 'hosting_expired']);
    }

    public function test_check_expired_hosting_services_job_does_not_touch_services_not_yet_due(): void
    {
        $service = $this->createProvisionableHostingService([], [
            'status' => 'active',
            'renews_at' => now()->addDays(10)->toDateString(),
        ]);

        (new CheckExpiredHostingServicesJob())->handle($this->app->make(\App\Services\Notifications\ClientNotifier::class));

        $this->assertSame('active', $service->fresh()->status);
    }

    public function test_suspend_expired_hosting_job_deactivates_after_grace_period_ends(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $service->forceFill([
            'status' => 'expired',
            'expired_at' => now()->subDays(31),
            'grace_period_ends_at' => now()->subDay()->toDateString(),
        ])->save();

        (new SuspendExpiredHostingJob())->handle();

        $service->refresh();
        $this->assertSame('suspended', $service->status);
        $this->assertNotNull($service->scheduled_deletion_at);

        $call = collect($fake->calls)->last(fn ($call) => $call['method'] === 'sitesWebDomainUpdate');
        $this->assertNotNull($call, 'Expected ISPConfig to be asked to deactivate the website.');
        $this->assertSame('n', $call['params']['active'] ?? null);

        $this->assertDatabaseHas('notification_logs', [
            'hosting_service_id' => $service->id,
            'template' => 'hosting_suspended_grace_period_ended',
        ]);
    }

    public function test_suspend_expired_hosting_job_ignores_services_still_within_grace_period(): void
    {
        $service = $this->createProvisionableHostingService([], [
            'status' => 'expired',
            'grace_period_ends_at' => now()->addDays(5)->toDateString(),
        ]);

        (new SuspendExpiredHostingJob())->handle();

        $this->assertSame('expired', $service->fresh()->status);
    }

    public function test_delete_expired_ispconfig_website_job_deletes_after_final_warning_was_sent(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $service->forceFill([
            'status' => 'suspended',
            'scheduled_deletion_at' => now()->toDateString(),
        ])->save();

        NotificationLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'channel' => 'mail',
            'template' => 'hosting_final_warning_1d',
            'subject' => 'Final Notice',
            'recipient' => 'client@example.test',
            'status' => 'sent',
            'sent_at' => now()->subDay(),
        ]);

        (new DeleteExpiredIspconfigWebsiteJob())->handle($this->app->make(\App\Services\Ispconfig\IspconfigWebsiteStatusService::class));

        $service->refresh();
        $this->assertSame('deleted_from_ispconfig', $service->status);
        $this->assertNotNull($service->deleted_from_ispconfig_at);
        // The local row itself must never be hard-deleted.
        $this->assertDatabaseHas('hosting_services', ['id' => $service->id]);
        $this->assertNull($service->deleted_at);

        $call = collect($fake->calls)->last(fn ($call) => $call['method'] === 'sitesWebDomainDelete');
        $this->assertNotNull($call, 'Expected ISPConfig to be asked to delete the website.');

        // The client account must remain untouched.
        $this->assertDatabaseHas('clients', ['id' => $service->client_id, 'deleted_at' => null]);
    }

    public function test_delete_expired_ispconfig_website_job_skips_deletion_when_final_warning_was_never_sent(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $service->forceFill([
            'status' => 'suspended',
            'scheduled_deletion_at' => now()->toDateString(),
        ])->save();

        (new DeleteExpiredIspconfigWebsiteJob())->handle($this->app->make(\App\Services\Ispconfig\IspconfigWebsiteStatusService::class));

        $this->assertSame('suspended', $service->fresh()->status);
        $this->assertNull(collect($fake->calls)->last(fn ($call) => $call['method'] === 'sitesWebDomainDelete'));
        $this->assertDatabaseHas('provisioning_logs', [
            'hosting_service_id' => $service->id,
            'action' => 'delete_website_from_ispconfig',
            'status' => 'review_required',
        ]);
    }

    public function test_send_hosting_expiry_reminder_job_does_not_duplicate_a_reminder_already_sent(): void
    {
        $service = $this->createProvisionableHostingService([], [
            'status' => 'active',
            'renews_at' => now()->addDays(7)->toDateString(),
        ]);

        $notifier = $this->app->make(\App\Services\Notifications\ClientNotifier::class);
        (new SendHostingExpiryReminderJob())->handle($notifier);
        $this->assertSame(1, NotificationLog::query()->where('hosting_service_id', $service->id)->where('template', 'hosting_renewal_reminder_7d')->count());

        (new SendHostingExpiryReminderJob())->handle($notifier);
        $this->assertSame(1, NotificationLog::query()->where('hosting_service_id', $service->id)->where('template', 'hosting_renewal_reminder_7d')->count());
    }

    public function test_client_account_remains_after_hosting_deleted_from_ispconfig(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);
        $clientId = $service->client_id;

        $service->forceFill(['status' => 'suspended', 'scheduled_deletion_at' => now()->toDateString()])->save();
        NotificationLog::query()->create([
            'client_id' => $clientId,
            'hosting_service_id' => $service->id,
            'channel' => 'mail',
            'template' => 'hosting_final_warning_1d',
            'subject' => 'Final Notice',
            'recipient' => 'client@example.test',
            'status' => 'sent',
            'sent_at' => now()->subDay(),
        ]);

        (new DeleteExpiredIspconfigWebsiteJob())->handle($this->app->make(\App\Services\Ispconfig\IspconfigWebsiteStatusService::class));

        $client = Client::query()->find($clientId);
        $this->assertNotNull($client, 'Client account must remain after hosting is deleted from ISPConfig.');
        $this->assertNull($client->deleted_at);
    }
}
