<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Client;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\NotificationLog;
use App\Models\Payment;
use App\Models\ProvisioningLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * All fixtures here are factory-created test clients/services — never the
 * real ISPConfig-imported production data — per the safety rule that
 * destructive lifecycle actions must not be exercised against real
 * migrated accounts.
 */
class ClientAndServiceLifecycleTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Avoid stale ShouldBeUnique job locks bleeding between tests when
        // the sync queue driver executes dispatches inline.
        Cache::flush();
    }

    private function adminToken(): string
    {
        $this->seed();

        return $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    private function validReasonPayload(array $overrides = []): array
    {
        return array_merge([
            'reason_category' => 'non_payment',
            'reason_note' => 'Client has not paid for two renewal cycles.',
            'notify_client' => true,
        ], $overrides);
    }

    public function test_admin_cannot_suspend_a_client_without_providing_a_reason(): void
    {
        $token = $this->adminToken();
        $service = $this->createProvisionableHostingService();

        $this->withToken($token)->postJson("/api/v1/admin/clients/{$service->client_id}/suspend", [])
            ->assertStatus(422);

        $this->assertSame('active', $service->client->fresh()->client_status);
    }

    public function test_admin_can_suspend_a_test_client_and_reason_form_data_is_saved(): void
    {
        $token = $this->adminToken();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);

        $this->withToken($token)->postJson("/api/v1/admin/clients/{$service->client_id}/suspend", $this->validReasonPayload([
            'reason_category' => 'abuse_report',
            'reason_note' => 'Reported for spam distribution.',
            'supporting_reference' => 'TICKET-4821',
        ]))->assertOk()->assertJsonPath('client_status', 'suspended');

        $client = $service->client->fresh();
        $this->assertSame('suspended', $client->client_status);
        $this->assertNotNull($client->suspended_at);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'suspend_client',
            'client_id' => $client->id,
            'reason_category' => 'abuse_report',
            'reason' => 'Reported for spam distribution.',
            'supporting_reference' => 'TICKET-4821',
            'source' => 'admin',
        ]);
    }

    public function test_client_receives_email_after_suspension_and_it_is_logged(): void
    {
        $token = $this->adminToken();
        $service = $this->createProvisionableHostingService();

        $this->withToken($token)->postJson("/api/v1/admin/clients/{$service->client_id}/suspend", $this->validReasonPayload())
            ->assertOk();

        $this->assertDatabaseHas('notification_logs', [
            'client_id' => $service->client_id,
            'template' => 'client_suspended',
            'status' => 'sent',
        ]);
    }

    public function test_admin_can_soft_delete_and_restore_a_test_client(): void
    {
        $token = $this->adminToken();
        $service = $this->createProvisionableHostingService();
        $clientId = $service->client_id;

        $this->withToken($token)->deleteJson("/api/v1/admin/clients/{$clientId}", $this->validReasonPayload([
            'reason_category' => 'client_request',
            'reason_note' => 'Client asked to close their account.',
        ]))->assertOk();

        $this->assertSoftDeleted('clients', ['id' => $clientId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'soft_delete_client', 'client_id' => $clientId]);

        $this->withToken($token)->postJson("/api/v1/admin/clients/{$clientId}/restore")->assertOk();

        $client = Client::query()->findOrFail($clientId);
        $this->assertNull($client->deleted_at);
        $this->assertSame('active', $client->client_status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'restore_client', 'client_id' => $clientId]);
    }

    public function test_soft_deleting_a_client_preserves_invoices_payments_and_logs(): void
    {
        $token = $this->adminToken();
        $service = $this->createProvisionableHostingService();
        $clientId = $service->client_id;
        $invoiceId = Invoice::query()->where('client_id', $clientId)->firstOrFail()->id;

        Payment::query()->create([
            'client_id' => $clientId,
            'invoice_id' => $invoiceId,
            'gateway' => 'paystack',
            'reference' => 'PAY-TEST-'.$clientId,
            'status' => 'paid',
            'amount_kobo' => 2500000,
            'paid_at' => now(),
        ]);

        $this->withToken($token)->deleteJson("/api/v1/admin/clients/{$clientId}", $this->validReasonPayload())->assertOk();

        $this->assertSoftDeleted('clients', ['id' => $clientId]);
        $this->assertDatabaseHas('invoices', ['id' => $invoiceId, 'client_id' => $clientId]);
        $this->assertDatabaseHas('payments', ['reference' => 'PAY-TEST-'.$clientId]);
        $this->assertDatabaseHas('hosting_services', ['id' => $service->id, 'client_id' => $clientId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'soft_delete_client', 'client_id' => $clientId]);
    }

    public function test_deactivating_a_website_calls_ispconfig_and_notifies_the_client(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $token = $this->adminToken();

        $this->withToken($token)->postJson("/api/v1/admin/services/{$service->id}/deactivate-website", $this->validReasonPayload([
            'reason_category' => 'hosting_expired',
            'reason_note' => 'Client requested a pause.',
        ]))->assertOk()->assertJsonPath('queued', true);

        $call = collect($fake->calls)->last(fn ($call) => $call['method'] === 'sitesWebDomainUpdate');
        $this->assertNotNull($call, 'sitesWebDomainUpdate was never called.');
        $this->assertSame('n', $call['params']['active'] ?? null);

        $service->refresh();
        $this->assertSame('deactivated', $service->status);
        $this->assertFalse((bool) $service->is_security_action);

        $this->assertDatabaseHas('notification_logs', [
            'hosting_service_id' => $service->id,
            'template' => 'website_hosting_deactivated',
        ]);
    }

    public function test_security_deactivation_is_logged_separately_from_expiry_deactivation(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $token = $this->adminToken();

        $this->withToken($token)->postJson("/api/v1/admin/services/{$service->id}/deactivate-website", array_merge(
            $this->validReasonPayload(['reason_category' => 'security_threat', 'reason_note' => 'Malware detected on the site.']),
            ['is_security_action' => true],
        ))->assertOk();

        $service->refresh();
        $this->assertTrue((bool) $service->is_security_action);

        $this->assertDatabaseHas('audit_logs', [
            'hosting_service_id' => $service->id,
            'action' => 'security_deactivate_website',
            'source' => 'security',
        ]);
    }

    public function test_reactivating_a_website_calls_ispconfig(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $token = $this->adminToken();
        $this->withToken($token)->postJson("/api/v1/admin/services/{$service->id}/deactivate-website", $this->validReasonPayload())->assertOk();

        Cache::flush();

        $this->withToken($token)->postJson("/api/v1/admin/services/{$service->id}/reactivate-website", $this->validReasonPayload([
            'reason_category' => 'client_request',
            'reason_note' => 'Payment received, restoring service.',
        ]))->assertOk();

        $call = collect($fake->calls)->last(fn ($call) => $call['method'] === 'sitesWebDomainUpdate');
        $this->assertSame('y', $call['params']['active'] ?? null);

        $service->refresh();
        $this->assertSame('active', $service->status);
    }

    /**
     * Exercises IspconfigWebsiteStatusService directly rather than through
     * the queued job + HTTP route: under the "sync" queue driver tests run
     * on, a failed job re-throws straight into the HTTP response instead of
     * going through Laravel's real retry/backoff machinery (that only
     * engages under an actual async queue worker) — so the meaningful unit
     * to verify here is the service's own logging + re-throw contract.
     */
    public function test_failed_ispconfig_call_is_logged_and_retriable(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $fake->shouldFail('sitesWebDomainUpdate', new \App\Services\Ispconfig\Exceptions\IspConfigApiException('boom'));

        $websiteStatus = $this->app->make(\App\Services\Ispconfig\IspconfigWebsiteStatusService::class);
        $reason = $this->validReasonPayload();

        try {
            $websiteStatus->deactivate($service, $reason);
            $this->fail('Expected an IspConfigApiException to be thrown.');
        } catch (\App\Services\Ispconfig\Exceptions\IspConfigApiException) {
            // expected — the failure must still be logged before it propagates.
        }

        $log = AuditLog::query()->where('hosting_service_id', $service->id)->where('action', 'deactivate_website')->firstOrFail();
        $this->assertNotNull($log->error_details);
        $this->assertSame('failed', ProvisioningLog::query()->where('hosting_service_id', $service->id)->where('action', 'deactivate_website')->latest('id')->value('status'));
        // Local status already reflects intent even though the remote call
        // failed — but ispconfig_active (actual confirmed remote state)
        // must NOT have flipped, since we never confirmed it.
        $this->assertNull($service->fresh()->ispconfig_active);

        // Retriable: calling again once the underlying ISPConfig issue is resolved succeeds.
        $websiteStatus->deactivate($service->fresh(), $reason);
        $this->assertFalse($service->fresh()->ispconfig_active);
    }

    public function test_deleting_a_service_soft_deletes_it_and_preserves_the_row(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);

        $token = $this->adminToken();
        $this->withToken($token)->deleteJson("/api/v1/admin/services/{$service->id}", $this->validReasonPayload())->assertOk();

        $this->assertSoftDeleted('hosting_services', ['id' => $service->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'delete_service', 'hosting_service_id' => $service->id]);
    }
}
