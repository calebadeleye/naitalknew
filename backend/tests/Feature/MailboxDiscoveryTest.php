<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * Covers the gap behind another real incident: a mailbox created directly in
 * ISPConfig's own panel (rather than through the client dashboard) never
 * appeared in the client's Email Accounts list. SyncMailboxesJob only
 * refreshes MailboxRecords that already exist locally — it has no discovery
 * step for anything ISPConfig knows about that we don't. This is that
 * missing discovery step, admin-triggered per service.
 */
class MailboxDiscoveryTest extends TestCase
{
    use CreatesDomainFixtures, CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private function provisionedService($fake): HostingService
    {
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    private function ispConfigClientId(HostingService $service): int
    {
        return (int) $service->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first()->clientMapping->ispconfig_client_id;
    }

    public function test_it_imports_a_mailbox_that_exists_in_ispconfig_but_not_locally(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);
        $ispConfigClientId = $this->ispConfigClientId($service);

        // Simulates a mailbox someone created directly in ISPConfig's own
        // panel — never went through MailboxProvisioningActionJob, so there
        // is no local MailboxRecord for it at all.
        $sid = $fake->login();
        $fake->mailUserAdd($sid, $ispConfigClientId, [
            'email' => 'info@'.$service->primary_domain,
            'login' => 'info@'.$service->primary_domain,
            'quota' => 500,
            'name' => 'Info',
            'postfix' => 'y',
            'access' => 'y',
            'maildir' => '/var/vmail/'.$service->primary_domain.'/info/Maildir',
        ]);

        $this->assertSame(0, MailboxRecord::query()->where('hosting_service_id', $service->id)->count());

        $response = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/mailboxes/discover")
            ->assertOk();

        $expectedEmail = 'info@'.strtolower($service->primary_domain);

        $this->assertSame(1, $response->json('imported'));
        $this->assertSame($expectedEmail, $response->json('mailboxes.0.email_address'));

        $mailbox = MailboxRecord::query()->where('hosting_service_id', $service->id)->firstOrFail();
        $this->assertSame($expectedEmail, $mailbox->email_address);
        $this->assertSame('active', $mailbox->status);
        $this->assertSame('ispconfig_import', $mailbox->source);
        $this->assertNotNull($mailbox->imported_at);
        $this->assertSame(500, $mailbox->quota_mb);
    }

    public function test_it_does_not_duplicate_a_mailbox_that_is_already_tracked_locally(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);
        $ispConfigClientId = $this->ispConfigClientId($service);
        $token = $this->clientTokenFor($service);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/mailboxes", [
            'username' => 'sales',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $this->assertSame(1, MailboxRecord::query()->where('hosting_service_id', $service->id)->count());

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/mailboxes/discover")
            ->assertOk();

        $this->assertSame(0, $response->json('imported'));
        $this->assertSame(1, MailboxRecord::query()->where('hosting_service_id', $service->id)->count());
    }

    public function test_it_ignores_mailboxes_belonging_to_a_different_domain_for_the_same_ispconfig_client(): void
    {
        $this->seed();
        $fake = $this->fakeIspConfig();
        $admin = $this->domainAdminToken();
        $service = $this->provisionedService($fake);
        $ispConfigClientId = $this->ispConfigClientId($service);

        $sid = $fake->login();
        $fake->mailUserAdd($sid, $ispConfigClientId, [
            'email' => 'someone@a-completely-different-domain.test',
            'login' => 'someone@a-completely-different-domain.test',
            'postfix' => 'y',
        ]);

        $response = $this->withToken($admin)->postJson("/api/v1/admin/services/{$service->id}/mailboxes/discover")
            ->assertOk();

        $this->assertSame(0, $response->json('imported'));
    }

    private function clientTokenFor(HostingService $service): string
    {
        $user = $service->client->user;
        $user->forceFill(['password' => \Illuminate\Support\Facades\Hash::make('secret-password')])->save();

        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])
            ->assertOk()->json('token');
    }
}
