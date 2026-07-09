<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\DatabaseRecord;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\IspConfigClientMapping;
use App\Models\MailboxRecord;
use App\Models\User;
use App\Services\Billing\LegacyRenewalInvoiceService;
use App\Services\Ispconfig\LegacyImportService;
use App\Services\Ispconfig\LegacyRenewalDateCalculator;
use Carbon\Carbon;
use Database\Seeders\HostingPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class IspConfigLegacyImportTest extends TestCase
{
    use FakesIspConfig, RefreshDatabase;

    private function adminToken(): string
    {
        $this->seed();

        return $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    /**
     * Seeds one fake ISPConfig client with a website. Returns the remote
     * client_id and domain so the caller can attach more fixtures (mailboxes,
     * databases) to the same client/site.
     *
     * @return array{client_id: int, domain: string}
     */
    private function seedRemoteClient($fake, array $clientAttributes = [], array $siteAttributes = []): array
    {
        $sessionId = $fake->login();

        $clientId = $fake->clientAdd($sessionId, 0, array_merge([
            'company_name' => 'Acme Nigeria Ltd',
            'email' => 'billing@acme-'.Str::random(6).'.test',
        ], $clientAttributes));

        $domain = 'acme-'.Str::random(6).'.test';

        $fake->sitesWebDomainAdd($sessionId, $clientId, array_merge([
            'domain' => $domain,
        ], $siteAttributes));

        $fake->logout($sessionId);

        return ['client_id' => $clientId, 'domain' => $domain];
    }

    public function test_legacy_package_is_seeded_correctly_and_hidden_from_public_pricing_page(): void
    {
        (new HostingPlanSeeder())->run();

        $plan = HostingPlan::query()->where('slug', 'legacy-hosting-ssl')->firstOrFail();

        $this->assertSame('Legacy Hosting + SSL', $plan->name);
        $this->assertSame('legacy', $plan->plan_type);
        $this->assertSame(2_500_000, $plan->hosting_amount_kobo);
        $this->assertSame(1_500_000, $plan->ssl_amount_kobo);
        $this->assertSame(4_000_000, $plan->annual_price_kobo);
        $this->assertSame('NGN', $plan->currency);
        $this->assertFalse($plan->is_public);
        $this->assertFalse($plan->is_orderable);
        $this->assertSame('active_internal', $plan->status);

        // Running it twice must not create a second row (idempotent seeder).
        (new HostingPlanSeeder())->run();
        $this->assertSame(1, HostingPlan::query()->where('slug', 'legacy-hosting-ssl')->count());

        $response = $this->getJson('/api/v1/public/hosting-plans')->assertOk();
        $slugs = collect($response->json())->pluck('slug');
        $this->assertNotContains('legacy-hosting-ssl', $slugs);
    }

    public function test_legacy_package_is_not_orderable_through_checkout(): void
    {
        $this->seed();
        $client = Client::query()->where('client_code', 'CLT-202607-JOHN')->firstOrFail();
        $client->forceFill(['account_type' => 'billing_client'])->save();
        $userToken = $this->postJson('/api/v1/auth/login', [
            'email' => $client->user->email,
            'password' => 'password',
        ])->assertOk()->json('token');

        $this->withToken($userToken)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'legacy-hosting-ssl',
            'primary_domain' => 'example.test',
            'billing_cycle' => 'annual',
            'terms_accepted' => true,
        ])->assertStatus(404);
    }

    public function test_import_assigns_new_clients_and_websites_to_the_legacy_package(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake, ['created_at' => '2024-03-15 09:00:00'], ['created_at' => '2024-03-15 09:00:00']);

        $result = (new LegacyImportService($fake))->run(dryRun: false);

        $this->assertSame('imported_client', $result['clients'][0]['import_status']);

        $service = HostingService::query()->where('source', 'ispconfig_import')->firstOrFail();
        $legacyPlan = HostingPlan::query()->where('slug', 'legacy-hosting-ssl')->firstOrFail();

        $this->assertSame($legacyPlan->id, $service->hosting_plan_id);
        $this->assertSame('legacy', $service->plan_type);
        $this->assertSame('imported_existing', $service->provisioning_status);
        $this->assertNotNull($service->imported_at);
        $this->assertNotNull($service->last_synced_at);
    }

    public function test_import_never_calls_ispconfig_create_update_or_delete_methods(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake, ['created_at' => '2024-03-15'], ['created_at' => '2024-03-15']);

        // Only the setup calls above should have touched the fake so far.
        $fake->calls = [];

        (new LegacyImportService($fake))->run(dryRun: false);

        $forbidden = [
            'clientAdd', 'sitesWebDomainAdd', 'sitesWebDomainDelete',
            'mailDomainAdd', 'mailUserAdd', 'mailUserUpdate', 'mailUserDelete',
            'databasesDatabaseAdd', 'databasesDatabaseUserAdd', 'databasesDatabaseUserUpdate',
            'databasesDatabaseDelete', 'databasesDatabaseUserDelete',
            'ftpUserAdd', 'ftpUserUpdate', 'ftpUserDelete',
        ];

        $calledMethods = collect($fake->calls)->pluck('method')->unique()->all();

        foreach ($forbidden as $method) {
            $this->assertNotContains($method, $calledMethods, "Import must never call {$method}().");
        }
    }

    public function test_ispconfig_creation_date_is_stored_when_available(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake, [], ['created_at' => '2024-03-15 08:00:00']);

        (new LegacyImportService($fake))->run(dryRun: false);

        $service = HostingService::query()->where('source', 'ispconfig_import')->firstOrFail();

        $this->assertNotNull($service->created_from_ispconfig_at);
        $this->assertSame('2024-03-15', $service->created_from_ispconfig_at->toDateString());
        $this->assertSame('ispconfig_created_date', $service->renewal_date_source);
        $this->assertNull($service->renewal_status);
    }

    public function test_next_yearly_renewal_date_is_calculated_correctly(): void
    {
        $createdAt = Carbon::parse('2024-03-15');
        $today = Carbon::parse('2026-07-08');

        $renewal = LegacyRenewalDateCalculator::nextAnniversary($createdAt, $today);

        $this->assertSame('2027-03-15', $renewal->toDateString());
    }

    public function test_import_calculates_the_next_yearly_renewal_date_for_a_service(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-08'));

        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake, [], ['created_at' => '2024-03-15']);

        (new LegacyImportService($fake))->run(dryRun: false);

        $service = HostingService::query()->where('source', 'ispconfig_import')->firstOrFail();

        $this->assertSame('2027-03-15', $service->hosting_expires_at->toDateString());
        $this->assertSame('2027-03-15', $service->ssl_expires_at->toDateString());
        $this->assertSame('2027-03-15', $service->next_invoice_date->toDateString());

        Carbon::setTestNow();
    }

    public function test_manual_renewal_date_is_required_when_creation_date_is_missing(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        // No created_at anywhere — ISPConfig gives us nothing to calculate from.
        $this->seedRemoteClient($fake);

        (new LegacyImportService($fake))->run(dryRun: false);

        $service = HostingService::query()->where('source', 'ispconfig_import')->firstOrFail();

        $this->assertNull($service->created_from_ispconfig_at);
        $this->assertSame('manual_required', $service->renewal_date_source);
        $this->assertSame('pending_manual_renewal_date', $service->renewal_status);
        $this->assertNull($service->hosting_expires_at);
    }

    public function test_admin_can_override_the_calculated_renewal_date(): void
    {
        $token = $this->adminToken();
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake);
        (new LegacyImportService($fake))->run(dryRun: false);

        $service = HostingService::query()->where('source', 'ispconfig_import')->firstOrFail();
        $this->assertSame('manual_required', $service->renewal_date_source);

        $this->withToken($token)->postJson("/api/v1/admin/legacy-services/{$service->id}/override-renewal-date", [
            'renewal_date' => '2027-01-01',
        ])->assertOk()
            ->assertJsonPath('renewal_date_source', 'manual_override')
            ->assertJsonPath('hosting_expires_at', '2027-01-01');

        $service->refresh();
        $this->assertSame('manual_override', $service->renewal_date_source);
        $this->assertNull($service->renewal_status);
        $this->assertSame('2027-01-01', $service->next_invoice_date->toDateString());
    }

    public function test_legacy_invoice_line_items_total_forty_thousand_naira(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake, ['created_at' => '2024-03-15'], ['created_at' => '2024-03-15']);
        (new LegacyImportService($fake))->run(dryRun: false);

        $service = HostingService::query()->where('source', 'ispconfig_import')->firstOrFail();

        $invoice = (new LegacyRenewalInvoiceService())->generate($service);

        $this->assertSame(4_000_000, $invoice->total_kobo);
        $this->assertNull($invoice->order_id);
        $this->assertCount(2, $invoice->line_items);
        $this->assertSame('Hosting Renewal', $invoice->line_items[0]['description']);
        $this->assertSame(2_500_000, $invoice->line_items[0]['total_kobo']);
        $this->assertSame('SSL Renewal', $invoice->line_items[1]['description']);
        $this->assertSame(1_500_000, $invoice->line_items[1]['total_kobo']);
        $this->assertSame(
            $invoice->line_items[0]['total_kobo'] + $invoice->line_items[1]['total_kobo'],
            $invoice->total_kobo
        );
    }

    public function test_rerunning_the_import_does_not_duplicate_clients_websites_mailboxes_or_databases(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $seeded = $this->seedRemoteClient($fake, ['created_at' => '2024-03-15'], ['created_at' => '2024-03-15']);

        $sessionId = $fake->login();
        $fake->mailUserAdd($sessionId, $seeded['client_id'], ['email' => 'info@'.$seeded['domain']]);
        $fake->databasesDatabaseAdd($sessionId, $seeded['client_id'], ['database_name' => 'acme_db', 'database_user' => 'acme_user']);
        $fake->logout($sessionId);

        $importer = new LegacyImportService($fake);
        $importer->run(dryRun: false);
        $importer->run(dryRun: false);
        $importer->run(dryRun: false);

        $this->assertSame(1, Client::query()->count());
        $this->assertSame(1, HostingService::query()->count());
        $this->assertSame(1, IspConfigClientMapping::query()->count());
        $this->assertSame(1, MailboxRecord::query()->count());
        $this->assertSame(1, DatabaseRecord::query()->count());
    }

    public function test_existing_local_client_is_linked_instead_of_duplicated(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $seeded = $this->seedRemoteClient($fake);

        $user = User::factory()->create(['role' => 'client']);
        $existingClient = Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CLT-PRE-EXISTING',
            'account_type' => 'billing_client',
            'client_status' => 'active',
            'status' => 'active',
            'billing_email' => $user->email,
            'country' => 'Nigeria',
        ]);

        IspConfigClientMapping::query()->create([
            'client_id' => $existingClient->id,
            'ispconfig_server_id' => (int) config('ispconfig.server_id', 1),
            'ispconfig_client_id' => (string) $seeded['client_id'],
            'sync_status' => 'provisioned',
        ]);

        $result = (new LegacyImportService($fake))->run(dryRun: false);

        $this->assertSame('linked_existing_client', $result['clients'][0]['import_status']);
        $this->assertSame($existingClient->id, $result['clients'][0]['client_id']);
        $this->assertSame(1, Client::query()->count());

        $service = HostingService::query()->firstOrFail();
        $this->assertSame($existingClient->id, $service->client_id);
    }

    public function test_imported_mailboxes_and_databases_do_not_store_passwords(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $seeded = $this->seedRemoteClient($fake, ['created_at' => '2024-03-15'], ['created_at' => '2024-03-15']);

        $sessionId = $fake->login();
        $fake->mailUserAdd($sessionId, $seeded['client_id'], [
            'email' => 'info@'.$seeded['domain'],
            'password' => 'super-secret-remote-password',
        ]);
        $fake->databasesDatabaseAdd($sessionId, $seeded['client_id'], [
            'database_name' => 'acme_db',
            'database_user' => 'acme_user',
            'password' => 'super-secret-db-password',
        ]);
        $fake->logout($sessionId);

        (new LegacyImportService($fake))->run(dryRun: false);

        $mailbox = MailboxRecord::query()->firstOrFail();
        $database = DatabaseRecord::query()->firstOrFail();

        $this->assertArrayNotHasKey('password', $mailbox->getAttributes());
        $this->assertArrayNotHasKey('password', $database->getAttributes());
        $this->assertSame('Password not available. Reset if needed.', $mailbox->metadata_json['password_note']);
        $this->assertSame('Password not available. Reset if needed.', $database->metadata_json['password_note']);
        $this->assertStringNotContainsString('super-secret', json_encode($mailbox->metadata_json));
        $this->assertStringNotContainsString('super-secret', json_encode($database->metadata_json));
    }

    public function test_legacy_service_can_later_be_migrated_to_a_website_care_package(): void
    {
        $token = $this->adminToken();
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake, ['created_at' => '2024-03-15'], ['created_at' => '2024-03-15']);
        (new LegacyImportService($fake))->run(dryRun: false);

        $service = HostingService::query()->where('source', 'ispconfig_import')->firstOrFail();
        $this->assertSame('legacy', $service->migration_status);

        $this->withToken($token)->postJson("/api/v1/admin/legacy-services/{$service->id}/migrate", [
            'target_package_slug' => 'business-website-care',
        ])->assertOk()
            ->assertJsonPath('migration_status', 'migrated')
            ->assertJsonPath('plan_type', 'website_care');

        $service->refresh();
        $businessPlan = HostingPlan::query()->where('slug', 'business-website-care')->firstOrFail();

        $this->assertSame($businessPlan->id, $service->hosting_plan_id);
        $this->assertSame('website_care', $service->plan_type);
        $this->assertSame('migrated', $service->migration_status);
        $this->assertNotNull($service->migrated_at);

        // Import must never have performed this automatically — it's still
        // only true because of the explicit admin action above.
        $this->assertDatabaseHas('audit_logs', ['action' => 'migrate_legacy_service_to_website_care']);
    }

    public function test_dry_run_preview_does_not_write_anything_to_the_database(): void
    {
        (new HostingPlanSeeder())->run();
        $fake = $this->fakeIspConfig();
        $this->seedRemoteClient($fake, ['created_at' => '2024-03-15'], ['created_at' => '2024-03-15']);

        $result = (new LegacyImportService($fake))->run(dryRun: true);

        $this->assertTrue($result['dry_run']);
        $this->assertSame('imported_client', $result['clients'][0]['import_status']);
        $this->assertSame(0, Client::query()->count());
        $this->assertSame(0, HostingService::query()->count());
        $this->assertSame(0, IspConfigClientMapping::query()->count());
    }
}
