<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\MailboxRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class HostingControlPanelApiTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    public function test_client_can_view_their_own_service_overview(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->getJson("/api/v1/client/services/{$service->id}/manage")
            ->assertOk()
            ->assertJsonStructure(['overview', 'usage', 'capabilities']);
    }

    public function test_another_client_cannot_view_a_service_they_do_not_own(): void
    {
        $service = $this->createProvisionableHostingService();
        $other = $this->createProvisionableHostingService();

        Sanctum::actingAs($other->client->user, [], 'sanctum');

        $this->getJson("/api/v1/client/services/{$service->id}/manage")->assertForbidden();
    }

    public function test_ftp_is_enabled_for_every_hosting_service(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->getJson("/api/v1/client/services/{$service->id}/manage")
            ->assertOk()
            ->assertJsonPath('capabilities.ftp_sftp_enabled', true)
            ->assertJsonPath('capabilities.ssh_access_enabled', false);
    }

    public function test_creating_an_ftp_account_beyond_the_two_account_limit_is_rejected(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->postJson("/api/v1/client/services/{$service->id}/ftp-accounts", [
            'username' => 'first',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $this->postJson("/api/v1/client/services/{$service->id}/ftp-accounts", [
            'username' => 'second',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $this->postJson("/api/v1/client/services/{$service->id}/ftp-accounts", [
            'username' => 'third',
            'password' => 'a-strong-password',
        ])->assertForbidden();
    }

    public function test_hosting_services_are_auto_renewed_by_default(): void
    {
        $service = $this->createProvisionableHostingService();

        // The fixture's create() call doesn't pass auto_renew_enabled, so the
        // in-memory model won't reflect it until re-fetched — this is
        // asserting the database column default, not the model instance.
        $this->assertTrue($service->fresh()->auto_renew_enabled);
    }

    public function test_client_can_turn_off_auto_renew_for_their_own_service(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->getJson("/api/v1/client/services/{$service->id}/manage")
            ->assertJsonPath('overview.auto_renew_enabled', true);

        $this->postJson("/api/v1/client/services/{$service->id}/manage/auto-renew", ['auto_renew_enabled' => false])
            ->assertOk()
            ->assertJsonPath('auto_renew_enabled', false);

        $this->assertFalse($service->fresh()->auto_renew_enabled);

        $this->getJson("/api/v1/client/services/{$service->id}/manage")
            ->assertJsonPath('overview.auto_renew_enabled', false);
    }

    public function test_another_client_cannot_toggle_auto_renew_for_a_service_they_do_not_own(): void
    {
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        $other = $this->createProvisionableHostingService();

        Sanctum::actingAs($other->client->user, [], 'sanctum');

        $this->postJson("/api/v1/client/services/{$service->id}/manage/auto-renew", ['auto_renew_enabled' => false])
            ->assertForbidden();

        $this->assertTrue($service->fresh()->auto_renew_enabled);
    }

    public function test_creating_a_mailbox_beyond_the_plan_limit_is_rejected(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService(['max_email_accounts' => 1], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->postJson("/api/v1/client/services/{$service->id}/mailboxes", [
            'username' => 'first',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $this->postJson("/api/v1/client/services/{$service->id}/mailboxes", [
            'username' => 'second',
            'password' => 'a-strong-password',
        ])->assertForbidden();
    }

    public function test_creating_a_mailbox_never_persists_the_plaintext_password(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->postJson("/api/v1/client/services/{$service->id}/mailboxes", [
            'username' => 'secure',
            'password' => 'a-very-secret-password',
        ])->assertStatus(202);

        $mailbox = MailboxRecord::query()->where('email_address', 'secure@'.$service->primary_domain)->firstOrFail();
        $raw = json_encode($mailbox->getAttributes());

        $this->assertStringNotContainsString('a-very-secret-password', $raw);
        $this->assertSame('active', $mailbox->status);
        $this->assertNotNull($mailbox->ispconfig_mailbox_id);
    }

    public function test_deleting_a_mailbox_requires_explicit_confirmation(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        Sanctum::actingAs($service->client->user, [], 'sanctum');

        $this->postJson("/api/v1/client/services/{$service->id}/mailboxes", [
            'username' => 'todelete',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $mailbox = MailboxRecord::query()->where('email_address', 'todelete@'.$service->primary_domain)->firstOrFail();

        $this->deleteJson("/api/v1/client/services/{$service->id}/mailboxes/{$mailbox->id}")
            ->assertStatus(422);

        $this->deleteJson("/api/v1/client/services/{$service->id}/mailboxes/{$mailbox->id}", ['confirm' => true])
            ->assertStatus(202);

        $this->assertSame('deleted', $mailbox->fresh()->status);
    }
}
