<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\Domain;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use App\Models\SupportTicket;
use App\Notifications\EmailOnlySetupInstructions;
use App\Notifications\NaiTalkHostingProvisioned;
use App\Services\Email\BusinessEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/** Green Mail on its own: business email on the client's domain, no website. */
class EmailOnlyPlanTest extends TestCase
{
    use CreatesDomainFixtures, CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    /** An email-only service ready to provision (paid), on a domain the client owns elsewhere. */
    private function emailOnlyService(array $serviceAttributes = []): HostingService
    {
        $service = $this->createProvisionableHostingService(['website_enabled' => false, 'max_email_accounts' => 5, 'disk_quota_mb' => 5120], $serviceAttributes);
        $service->hostingPlan->forceFill(['plan_type' => HostingPlan::TYPE_EMAIL])->save();
        $service->forceFill(['service_type' => 'email'])->save();

        return $service->fresh();
    }

    public function test_the_three_email_plans_exist_and_are_listed_apart_from_website_plans(): void
    {
        $this->seed();

        $website = collect($this->getJson('/api/v1/public/hosting-plans')->assertOk()->json());
        $email = collect($this->getJson('/api/v1/public/hosting-plans?type=email')->assertOk()->json());

        $this->assertSame(['email-starter', 'email-business', 'email-pro'], $email->pluck('slug')->all());
        $this->assertSame(['₦12,000', '₦30,000', '₦60,000'], $email->pluck('annual_price')->all());
        $this->assertTrue($website->isNotEmpty());
        $this->assertFalse($website->contains(fn ($plan) => str_starts_with($plan['slug'], 'email-')), 'pricing grids for websites never show the email plans');
        $this->assertFalse(HostingPlan::query()->where('slug', 'email-business')->firstOrFail()->configuration()['website_enabled']);
    }

    public function test_ordering_an_email_plan_records_an_email_service_for_a_domain_kept_elsewhere(): void
    {
        $this->fakeIspConfig();
        $this->seed();
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('email-only@example.test');

        $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'email-business',
            'billing_cycle' => 'annual',
            'primary_domain' => 'mybusiness.com',
            'terms_accepted' => true,
        ])->assertCreated()->assertJsonPath('order.items.0.description', 'Email Business');

        $service = HostingService::query()->where('client_id', $client->id)->firstOrFail();
        $this->assertSame('email', $service->service_type);
        $this->assertTrue($service->isEmailOnly());
        $this->assertSame('external', Domain::query()->where('domain_name', 'mybusiness.com')->value('source'));
    }

    public function test_an_email_plan_is_refused_for_a_domain_whose_website_plan_already_includes_email(): void
    {
        $this->fakeIspConfig();
        $this->seed();
        $existing = $this->createProvisionableHostingService([], ['primary_domain' => 'hasasite.com', 'status' => 'active']);
        ['token' => $token] = $this->registerVerifiedDomainClient('dup-email@example.test');

        $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'email-starter',
            'billing_cycle' => 'annual',
            'primary_domain' => 'hasasite.com',
            'terms_accepted' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('primary_domain');

        $quote = $this->withToken($token)->postJson('/api/v1/client/cart/quote', ['lines' => [
            ['type' => 'hosting', 'plan_slug' => 'email-starter', 'primary_domain' => 'hasasite.com'],
            ['type' => 'hosting', 'plan_slug' => 'email-starter', 'primary_domain' => 'freshdomain.com'],
        ]])->assertOk();

        $this->assertStringContainsString('already has business email included', $quote->json('lines.0.error'));
        $this->assertSame('Email Starter', $quote->json('lines.1.title'));
        $this->assertArrayNotHasKey('error', $quote->json('lines.1'));
        $this->assertSame('active', $existing->fresh()->status);
    }

    public function test_provisioning_creates_only_the_mail_domain_with_dkim_and_emails_the_dns_records(): void
    {
        Notification::fake();
        $fake = $this->fakeIspConfig();
        $service = $this->emailOnlyService();

        ProvisionHostingServiceJob::dispatch($service->id);
        ProvisionHostingServiceJob::dispatch($service->id);

        $service->refresh();
        $this->assertSame('active', $service->status);
        $this->assertSame('provisioned', $service->provisioning_status);
        $this->assertSame(0, collect($fake->calls)->where('method', 'sitesWebDomainAdd')->count(), 'no website for email-only');
        $this->assertSame(1, collect($fake->calls)->where('method', 'mailDomainAdd')->count());

        $mailDomain = collect($fake->calls)->firstWhere('method', 'mailDomainAdd')['params'];
        $this->assertSame('y', $mailDomain['dkim']);
        $this->assertSame('default', $mailDomain['dkim_selector']);
        $this->assertStringStartsWith('-----BEGIN PRIVATE KEY-----', $mailDomain['dkim_private']);
        $this->assertStringStartsWith('-----BEGIN PUBLIC KEY-----', $mailDomain['dkim_public']);

        Notification::assertNotSentTo($service->client->user, NaiTalkHostingProvisioned::class);
        Notification::assertSentToTimes($service->client->user, EmailOnlySetupInstructions::class, 1);
        Notification::assertSentTo($service->client->user, EmailOnlySetupInstructions::class, function (EmailOnlySetupInstructions $notification) use ($service) {
            $records = collect($notification->records)->keyBy('key');
            $mail = $notification->toMail($service->client->user);

            return ! $notification->domainWithUs
                && $records['mx']['value'] === 'mail.naitalk.com'
                && str_starts_with($records['dkim']['value'], 'v=DKIM1; t=s; p=MII')
                && $records['dkim']['host'] === 'default._domainkey'
                && count($mail->rawAttachments) === 1;
        });
        $this->assertSame(0, SupportTicket::query()->count(), 'a domain kept elsewhere needs no ticket — the client adds the records');
    }

    public function test_for_a_domain_registered_with_us_our_team_gets_a_ticket_to_add_the_records(): void
    {
        Notification::fake();
        $this->fakeIspConfig();
        $service = $this->emailOnlyService();
        Domain::query()->create([
            'client_id' => $service->client_id,
            'domain_name' => $service->primary_domain,
            'tld' => '.com',
            'source' => 'spaceship_registration',
            'registration_status' => 'registered',
        ]);

        ProvisionHostingServiceJob::dispatch($service->id);

        $ticket = SupportTicket::query()->sole();
        $this->assertSame($service->id, $ticket->hosting_service_id);
        $this->assertStringContainsString('DNS setup', $ticket->subject);
        $this->assertSame($ticket->ticket_number, $service->fresh()->provisioning_payload['email_setup_ticket']);
        Notification::assertSentTo($service->client->user, EmailOnlySetupInstructions::class, fn ($n) => $n->domainWithUs && $n->ticketNumber === $ticket->ticket_number);
    }

    public function test_the_client_area_shows_the_records_with_a_live_check_and_can_resend_them(): void
    {
        Notification::fake();
        $this->fakeIspConfig();
        $service = $this->emailOnlyService();
        ProvisionHostingServiceJob::dispatch($service->id);
        $service->refresh();

        $this->app->bind(BusinessEmail::class, fn ($app) => new class($app->make(\App\Services\Ispconfig\IspConfigClient::class)) extends BusinessEmail
        {
            protected function lookup(string $name, int $type): array
            {
                return $type === DNS_MX ? [['target' => 'mail.naitalk.com']] : [];
            }
        });

        $user = $service->client->user;
        $this->actingAs($user, 'sanctum');

        $setup = $this->getJson("/api/v1/client/services/{$service->id}/email-setup")->assertOk();
        $records = collect($setup->json('records'))->keyBy('key');
        $this->assertTrue($setup->json('ready'));
        $this->assertSame('ok', $records['mx']['status']);
        $this->assertSame('missing', $records['dkim']['status']);
        $this->assertSame('missing', $records['spf']['status']);

        $this->getJson("/api/v1/client/services/{$service->id}/manage")->assertOk()
            ->assertJsonPath('capabilities.website_enabled', false)
            ->assertJsonPath('capabilities.email_only', true);

        $this->postJson("/api/v1/client/services/{$service->id}/email-setup/send")->assertOk();
        Notification::assertSentToTimes($user, EmailOnlySetupInstructions::class, 2);
    }

    public function test_mailbox_space_on_an_email_plan_is_what_is_not_given_to_other_mailboxes(): void
    {
        $this->fakeIspConfig();
        $service = $this->emailOnlyService(['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);
        MailboxRecord::query()->create(['hosting_service_id' => $service->id, 'email_address' => 'a@'.$service->primary_domain, 'quota_mb' => 4096, 'status' => 'active']);

        $this->actingAs($service->client->user, 'sanctum');

        $this->postJson("/api/v1/client/services/{$service->id}/mailboxes", ['username' => 'b', 'password' => 'a-long-password-1', 'quota_mb' => 2048])
            ->assertStatus(422)->assertJsonPath('message', 'That quota is more than the 1024 MB left in your package. Choose 1024 MB or less.');

        $this->postJson("/api/v1/client/services/{$service->id}/mailboxes", ['username' => 'b', 'password' => 'a-long-password-1'])->assertStatus(202);
        $this->assertSame(1024, MailboxRecord::query()->where('email_address', 'b@'.$service->primary_domain)->value('quota_mb'));
    }
}
