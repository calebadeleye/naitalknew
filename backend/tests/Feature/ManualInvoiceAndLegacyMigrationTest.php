<?php

namespace Tests\Feature;

use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\NotificationLog;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Notifications\NaiTalkPaymentReceived;
use App\Notifications\NaiTalkUnderpaymentReceived;
use App\Services\Ispconfig\LegacyImportService;
use App\Services\Ispconfig\LegacyServiceMigrator;
use Database\Seeders\HostingPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class ManualInvoiceAndLegacyMigrationTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    private function createManualInvoice(string $adminToken, int $clientId, int $unitPriceKobo = 12_000_000)
    {
        return $this->withToken($adminToken)->postJson('/api/v1/admin/invoices', [
            'client_id' => $clientId,
            'line_items' => [['description' => 'Custom project fee', 'quantity' => 1, 'unit_price_kobo' => $unitPriceKobo]],
            'due_at' => now()->addDays(7)->toDateString(),
        ])->assertCreated();
    }

    public function test_manual_invoice_for_a_client_with_no_services_is_listed_and_payable_from_their_account(): void
    {
        Notification::fake();
        $this->seed();
        ['token' => $clientToken, 'client' => $client] = $this->registerVerifiedDomainClient('no-services@example.test');
        $this->assertSame(0, $client->hostingServices()->count());

        $invoiceNumber = $this->createManualInvoice($this->domainAdminToken(), $client->id)->json('data.invoice_number');

        $this->app['auth']->forgetGuards();
        $this->withToken($clientToken)->getJson('/api/v1/client/invoices')
            ->assertOk()
            ->assertJsonPath('data.0.invoice_number', $invoiceNumber)
            ->assertJsonPath('data.0.status', 'unpaid')
            ->assertJsonPath('data.0.order_number', null)
            ->assertJsonPath('data.0.outstanding_kobo', 12_000_000);

        $this->withToken($clientToken)->getJson("/api/v1/client/invoices/{$invoiceNumber}")->assertOk();
        $this->withToken($clientToken)->getJson('/api/v1/client/dashboard')
            ->assertOk()
            ->assertJsonPath('invoices.0.invoice_number', $invoiceNumber);
    }

    public function test_manual_invoice_email_is_sent_and_logged(): void
    {
        Notification::fake();
        $this->seed();
        ['client' => $client] = $this->registerVerifiedDomainClient('invoice-mail@example.test');

        $invoiceNumber = $this->createManualInvoice($this->domainAdminToken(), $client->id)->json('data.invoice_number');

        Notification::assertSentTo($client->user, NaiTalkInvoiceCreated::class);
        $this->assertDatabaseHas('notification_logs', [
            'client_id' => $client->id,
            'template' => 'invoice_created',
            'recipient' => 'invoice-mail@example.test',
            'status' => 'sent',
            'subject' => "Your NAI TALK invoice {$invoiceNumber}",
        ]);
    }

    public function test_two_part_payments_are_both_applied_and_each_emails_the_client(): void
    {
        Notification::fake();
        $this->seed();
        ['token' => $clientToken, 'client' => $client] = $this->registerVerifiedDomainClient('instalments@example.test');
        $adminToken = $this->domainAdminToken();
        $invoiceNumber = $this->createManualInvoice($adminToken, $client->id, 10_000_000)->json('data.invoice_number');

        // First instalment: ₦40,000 of ₦100,000.
        $this->withToken($adminToken)->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => 4_000_000])->assertOk();

        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();
        $this->assertSame('partially_paid', $invoice->status);
        $this->assertSame(4_000_000, $invoice->amount_paid_kobo);
        Notification::assertSentTo($client->user, NaiTalkUnderpaymentReceived::class);

        // The client is now asked for the balance, not the whole invoice again.
        $this->app['auth']->forgetGuards();
        $bank = $this->withToken($clientToken)->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/bank-transfer")->assertOk();
        $this->assertSame('₦60,000', $bank->json('amount'));

        $this->app['auth']->forgetGuards();

        // Second instalment (defaults to the remaining balance) must not be
        // swallowed as a duplicate of the first.
        $this->withToken($adminToken)->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid")->assertOk();

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame(10_000_000, $invoice->amount_paid_kobo);
        $this->assertSame(0, $invoice->outstanding_amount_kobo);
        $this->assertSame(2, $invoice->payments()->where('gateway', 'bank_transfer')->where('status', 'paid')->count());
        Notification::assertSentTo($client->user, NaiTalkPaymentReceived::class);
        $this->assertDatabaseHas('notification_logs', ['client_id' => $client->id, 'template' => 'payment_received', 'status' => 'sent']);
        $this->assertDatabaseHas('notification_logs', ['client_id' => $client->id, 'template' => 'underpayment_received', 'status' => 'sent']);
    }

    /**
     * @return array{service: HostingService, domain: string, remote_client_id: int, website_id: int}
     */
    private function importLegacyService($fake, array $siteAttributes = []): array
    {
        (new HostingPlanSeeder)->run();

        $sessionId = $fake->login();
        $remoteClientId = $fake->clientAdd($sessionId, 0, ['company_name' => 'Acme Ltd', 'email' => 'acme-'.Str::random(6).'@example.test']);
        $domain = 'acme-'.Str::random(6).'.test';
        $websiteId = $fake->sitesWebDomainAdd($sessionId, $remoteClientId, array_merge(['domain' => $domain, 'type' => 'vhost', 'hd_quota' => '-1'], $siteAttributes));
        $fake->logout($sessionId);

        (new LegacyImportService($fake))->run(dryRun: false);

        return [
            'service' => HostingService::query()->where('primary_domain', $domain)->firstOrFail(),
            'domain' => $domain,
            'remote_client_id' => $remoteClientId,
            'website_id' => $websiteId,
        ];
    }

    public function test_migrating_a_legacy_service_to_starter_applies_the_disk_quota_in_ispconfig(): void
    {
        $fake = $this->fakeIspConfig();
        ['service' => $service, 'website_id' => $websiteId] = $this->importLegacyService($fake);
        $fake->setDiskUsageKb($websiteId, 300 * 1024);
        $starter = HostingPlan::where('slug', 'starter-website-care')->firstOrFail();

        $result = app(LegacyServiceMigrator::class)->migrate($service, $starter);

        $this->assertSame('migrated', $result['status']);
        $service->refresh();
        $this->assertSame($starter->id, $service->hosting_plan_id);
        $this->assertSame('website_care', $service->plan_type);
        $this->assertSame('migrated', $service->migration_status);
        $this->assertSame(10240, (int) $fake->sitesWebDomainGet($fake->login(), $websiteId)['hd_quota']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'migrate_legacy_service_to_website_care', 'hosting_service_id' => $service->id]);
    }

    public function test_migration_relinks_a_stale_website_id_by_domain(): void
    {
        $fake = $this->fakeIspConfig();
        ['service' => $service, 'website_id' => $websiteId] = $this->importLegacyService($fake);
        $service->ispConfigServiceMappings()->update(['ispconfig_website_id' => '9999']);
        $starter = HostingPlan::where('slug', 'starter-website-care')->firstOrFail();

        $result = app(LegacyServiceMigrator::class)->migrate($service, $starter);

        $this->assertSame('migrated', $result['status']);
        $this->assertTrue($result['quota']['repaired_website_id']);
        $this->assertSame((string) $websiteId, $service->ispConfigServiceMappings()->first()->ispconfig_website_id);
    }

    public function test_migration_refuses_to_shrink_a_site_that_is_nearly_full_and_changes_nothing(): void
    {
        $fake = $this->fakeIspConfig();
        ['service' => $service, 'website_id' => $websiteId] = $this->importLegacyService($fake);
        $fake->setDiskUsageKb($websiteId, 9800 * 1024);
        $legacyPlanId = $service->hosting_plan_id;
        $starter = HostingPlan::where('slug', 'starter-website-care')->firstOrFail();

        $result = app(LegacyServiceMigrator::class)->migrate($service, $starter);

        $this->assertSame('skipped', $result['status']);
        $this->assertSame($legacyPlanId, $service->fresh()->hosting_plan_id);
        $this->assertSame('-1', (string) $fake->sitesWebDomainGet($fake->login(), $websiteId)['hd_quota']);
    }

    public function test_dry_run_reports_without_changing_anything(): void
    {
        $fake = $this->fakeIspConfig();
        ['service' => $service, 'website_id' => $websiteId] = $this->importLegacyService($fake);
        $legacyPlanId = $service->hosting_plan_id;

        $this->artisan('hosting:migrate-legacy', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame($legacyPlanId, $service->fresh()->hosting_plan_id);
        $this->assertSame('-1', (string) $fake->sitesWebDomainGet($fake->login(), $websiteId)['hd_quota']);
    }

    public function test_usage_snapshot_reads_real_disk_usage_and_the_plan_quota_for_a_migrated_imported_service(): void
    {
        $fake = $this->fakeIspConfig();
        ['service' => $service, 'website_id' => $websiteId] = $this->importLegacyService($fake);
        $fake->setDiskUsageKb($websiteId, 2048 * 1024);
        app(LegacyServiceMigrator::class)->migrate($service, HostingPlan::where('slug', 'starter-website-care')->firstOrFail());

        SyncHostingUsageSnapshotJob::dispatchSync($service->id);

        $snapshot = $service->fresh()->latestUsageSnapshot();
        $this->assertNotNull($snapshot);
        $this->assertSame(2048, $snapshot->disk_used_mb);
        $this->assertSame(10240, $snapshot->disk_quota_mb);
        $this->assertSame(HostingPlan::UNLIMITED_EMAIL_ACCOUNTS, $snapshot->email_accounts_limit);
    }

    public function test_reimporting_does_not_drag_a_migrated_service_back_to_legacy(): void
    {
        $fake = $this->fakeIspConfig();
        ['service' => $service] = $this->importLegacyService($fake);
        $starter = HostingPlan::where('slug', 'starter-website-care')->firstOrFail();
        app(LegacyServiceMigrator::class)->migrate($service, $starter);

        (new LegacyImportService($fake))->run(dryRun: false);

        $service->refresh();
        $this->assertSame('website_care', $service->plan_type);
        $this->assertSame('migrated', $service->migration_status);
        $this->assertSame($starter->id, $service->hosting_plan_id);
    }
}
