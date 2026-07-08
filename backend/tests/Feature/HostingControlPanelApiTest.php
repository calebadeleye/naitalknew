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
