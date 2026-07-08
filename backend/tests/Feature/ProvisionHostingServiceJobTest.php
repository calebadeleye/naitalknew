<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Models\User;
use App\Notifications\HostingProvisioningFailed;
use App\Notifications\NaiTalkHostingProvisioned;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class ProvisionHostingServiceJobTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    public function test_it_provisions_a_client_and_website_and_seeds_a_usage_snapshot(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();

        ProvisionHostingServiceJob::dispatch($service->id);

        $service->refresh();

        $this->assertSame('active', $service->status);
        $this->assertSame('provisioned', $service->provisioning_status);
        $this->assertDatabaseHas('ispconfig_client_mappings', ['client_id' => $service->client_id]);
        $this->assertDatabaseHas('ispconfig_service_mappings', ['hosting_service_id' => $service->id]);
        $this->assertDatabaseHas('hosting_usage_snapshots', [
            'hosting_service_id' => $service->id,
            'source' => 'provisioning',
            'disk_quota_mb' => 10240,
            'email_accounts_limit' => 3,
        ]);

        $clientAddCalls = collect($fake->calls)->where('method', 'clientAdd')->count();
        $websiteAddCalls = collect($fake->calls)->where('method', 'sitesWebDomainAdd')->count();

        $this->assertSame(1, $clientAddCalls);
        $this->assertSame(1, $websiteAddCalls);
    }

    public function test_it_notifies_the_client_once_provisioning_succeeds_but_not_on_repeat_runs(): void
    {
        Notification::fake();

        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();

        ProvisionHostingServiceJob::dispatch($service->id);
        ProvisionHostingServiceJob::dispatch($service->id);

        Notification::assertSentToTimes($service->client->user, NaiTalkHostingProvisioned::class, 1);
    }

    public function test_it_is_idempotent_and_never_recreates_an_already_provisioned_client_or_website(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();

        ProvisionHostingServiceJob::dispatch($service->id);
        ProvisionHostingServiceJob::dispatch($service->id);
        ProvisionHostingServiceJob::dispatch($service->id);

        $clientAddCalls = collect($fake->calls)->where('method', 'clientAdd')->count();
        $websiteAddCalls = collect($fake->calls)->where('method', 'sitesWebDomainAdd')->count();

        $this->assertSame(1, $clientAddCalls);
        $this->assertSame(1, $websiteAddCalls);
        $this->assertDatabaseCount('ispconfig_client_mappings', 1);
        $this->assertDatabaseCount('ispconfig_service_mappings', 1);
    }

    public function test_it_reuses_an_existing_client_mapping_for_a_second_service_on_the_same_client(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        $secondService = $this->createProvisionableHostingService([], ['client_id' => $service->client_id]);

        ProvisionHostingServiceJob::dispatch($service->id);
        ProvisionHostingServiceJob::dispatch($secondService->id);

        $this->assertDatabaseCount('ispconfig_client_mappings', 1);
        $this->assertDatabaseCount('ispconfig_service_mappings', 2);
        $this->assertSame(1, collect($fake->calls)->where('method', 'clientAdd')->count());
        $this->assertSame(2, collect($fake->calls)->where('method', 'sitesWebDomainAdd')->count());
    }

    public function test_it_marks_the_service_failed_and_notifies_admins_when_ispconfig_rejects_the_request(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => 'super_admin']);

        $fake = $this->fakeIspConfig();
        $fake->shouldFail('clientAdd', new IspConfigApiException('ISPConfig rejected the client_add call.'));

        $service = $this->createProvisionableHostingService();

        // Under the sync queue driver (forced in phpunit.xml), Laravel's
        // FailingJob invokes the job's failed() callback and then re-throws
        // the original exception — real queue workers would instead retry
        // up to $tries times before ever reaching failed(). We only need to
        // assert the failure path here, so the rethrow is expected and safe
        // to swallow.
        try {
            ProvisionHostingServiceJob::dispatch($service->id);
        } catch (IspConfigApiException) {
            // expected under the sync driver
        }

        $service->refresh();

        $this->assertSame('provisioning_failed', $service->provisioning_status);
        $this->assertDatabaseHas('provisioning_logs', [
            'hosting_service_id' => $service->id,
            'action' => 'provision_hosting_service',
            'status' => 'failed',
        ]);
        $this->assertDatabaseHas('notification_logs', ['template' => 'hosting_provisioning_failed']);

        Notification::assertSentTo($admin, HostingProvisioningFailed::class);
    }
}
