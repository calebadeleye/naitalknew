<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * Regression coverage for a real production incident: a mailbox created
 * through the client dashboard authenticated fine but could not open its
 * inbox in webmail ("mail_location not set and autodetection failed",
 * confirmed directly in Dovecot's log). Root cause: ISPConfig's remote API
 * saves a new mail_user through a generic form insert that never runs the
 * maildir-computation logic its own admin panel's edit page does — so a
 * mailbox created via the SOAP API got no mail_location at all unless the
 * caller computes and sends `maildir` itself. There was no test at all
 * covering mailbox creation before this, which is very likely why this went
 * unnoticed.
 */
class MailboxProvisioningTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private function provisionedService($fake): HostingService
    {
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    private function clientToken(HostingService $service): string
    {
        $user = $service->client->user;
        $user->forceFill(['password' => Hash::make('secret-password')])->save();

        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])
            ->assertOk()->json('token');
    }

    public function test_creating_a_mailbox_sends_ispconfig_a_maildir_path_matching_this_servers_real_layout(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/mailboxes", [
            'username' => 'info',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $mailbox = MailboxRecord::query()->firstOrFail();
        $this->assertSame('active', $mailbox->status);
        $this->assertNotNull($mailbox->ispconfig_mailbox_id);

        $expectedMaildir = '/var/vmail/'.strtolower($service->primary_domain).'/info/Maildir';

        $addCall = collect($fake->calls)->firstWhere('method', 'mailUserAdd');
        $this->assertNotNull($addCall, 'mailUserAdd should have been called');
        $this->assertSame($expectedMaildir, $addCall['params']['maildir'] ?? null);

        // The value ISPConfig actually stored can be read back the same way
        // Dovecot's own userdb query would see it.
        $stored = $fake->mailUserGet('session', (int) $mailbox->ispconfig_mailbox_id);
        $this->assertSame($expectedMaildir, $stored['maildir']);
    }

    public function test_the_maildir_path_lowercases_the_local_part_and_domain(): void
    {
        $fake = $this->fakeIspConfig();
        $service = $this->provisionedService($fake);
        $token = $this->clientToken($service);

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/mailboxes", [
            'username' => 'Sales',
            'password' => 'a-strong-password',
        ])->assertStatus(202);

        $addCall = collect($fake->calls)->firstWhere('method', 'mailUserAdd');
        $this->assertSame(
            '/var/vmail/'.strtolower($service->primary_domain).'/sales/Maildir',
            $addCall['params']['maildir'] ?? null,
        );
    }
}
