<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\Greenmail\GreenmailCampaign;
use App\Models\Greenmail\GreenmailCampaignRecipient;
use App\Models\Greenmail\GreenmailContact;
use App\Models\Greenmail\GreenmailScheduledMessage;
use App\Models\Greenmail\GreenmailUnsubscribe;
use App\Models\MailboxRecord;
use App\Services\Greenmail\FakeMailGateway;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\MailRules;
use App\Services\Greenmail\MailSender;
use App\Services\Ispconfig\FakeIspConfigClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/** Notes, templates, filters/automation (Sieve), vacation reply, Send later and campaigns. */
class GreenmailToolsTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private FakeMailGateway $mail;

    private FakeIspConfigClient $isp;

    private int $mailUserId;

    /** @var array<int, array{message: RawMessage, envelope: ?Envelope}> */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->mail = new FakeMailGateway;
        $this->mail->addAccount('caleb@calebadeleye.com', 'mailbox-pass');
        $this->mail->addAccount('other@example.com', 'other-pass');
        $this->app->instance(MailGateway::class, $this->mail);

        $sent = &$this->sent;
        $this->app->instance(MailSender::class, new class($sent) extends MailSender
        {
            public function __construct(private array &$log) {}

            protected function transmit(RawMessage $message, ?Envelope $envelope, string $username, string $password): void
            {
                $this->log[] = ['message' => $message, 'envelope' => $envelope, 'username' => $username, 'password' => $password];
            }
        });

        // The mailbox as ISPConfig knows it, linked to a hosting service.
        $this->isp = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);
        $clientId = (int) $service->fresh()->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first()->clientMapping->ispconfig_client_id;
        $sid = $this->isp->login();
        $this->mailUserId = $this->isp->mailUserAdd($sid, $clientId, [
            'email' => 'caleb@calebadeleye.com',
            'autoresponder' => 'n',
            'custom_mailfilter' => "### BEGIN FILTER_ID:7\nif header :contains \"subject\" \"x\" { stop; }\n### END FILTER_ID:7",
        ]);
        MailboxRecord::query()->create(['hosting_service_id' => $service->id, 'ispconfig_mailbox_id' => (string) $this->mailUserId, 'email_address' => 'caleb@calebadeleye.com', 'quota_mb' => 500, 'status' => 'active']);
    }

    private function token(string $email = 'caleb@calebadeleye.com', string $password = 'mailbox-pass'): string
    {
        return $this->postJson('/api/v1/greenmail/session', ['email' => $email, 'password' => $password])->assertCreated()->json('token');
    }

    private function remote(): array
    {
        return $this->isp->mailUserGet('test', $this->mailUserId);
    }

    public function test_notes_belong_to_their_mailbox(): void
    {
        $token = $this->token();
        $other = $this->token('other@example.com', 'other-pass');

        $id = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/notes', ['title' => 'Call Ada', 'body' => 'About the invoice', 'pinned' => true])
            ->assertCreated()->assertJsonPath('note.pinned', true)->json('note.id');
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/notes', [])->assertStatus(422);

        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/notes?q=invoice')->assertJsonCount(1, 'notes');
        $this->withHeader('X-Greenmail-Token', $other)->getJson('/api/v1/greenmail/notes')->assertJsonCount(0, 'notes');
        $this->withHeader('X-Greenmail-Token', $other)->deleteJson("/api/v1/greenmail/notes/{$id}")->assertNotFound();
        $this->withHeader('X-Greenmail-Token', $token)->deleteJson("/api/v1/greenmail/notes/{$id}")->assertOk()->assertJsonPath('message', 'Note deleted.');
    }

    public function test_templates_are_cleaned_before_saving(): void
    {
        $token = $this->token();

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/templates', ['name' => 'Invoice', 'subject' => 'Your invoice', 'body_html' => '<p>Hi {{first_name}}</p><script>alert(1)</script>'])
            ->assertCreated()->assertJsonPath('template.body_html', '<p>Hi {{first_name}}</p>');
        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/templates')->assertJsonCount(1, 'templates');
    }

    public function test_filters_compile_into_the_mailboxs_sieve_block_and_keep_other_rules(): void
    {
        $token = $this->token();

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/rules', ['kind' => 'filter', 'field' => 'from', 'operator' => 'contains', 'value' => 'acme.com', 'action' => 'move', 'target' => 'Nowhere'])
            ->assertStatus(422)->assertJsonValidationErrors('target');

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/rules', ['kind' => 'filter', 'field' => 'from', 'operator' => 'contains', 'value' => 'acme.com', 'action' => 'move', 'target' => 'Junk'])
            ->assertCreated()->assertJsonPath('rule.name', 'From contains “acme.com” → Move to Junk');
        $rule = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/rules', ['kind' => 'filter', 'field' => 'subject', 'operator' => 'begins', 'value' => 'Sale "50%" *now*', 'action' => 'delete'])
            ->assertCreated()->json('rule');

        $sieve = $this->remote()['custom_mailfilter'];
        $this->assertStringStartsWith('### BEGIN FILTER_ID:7', $sieve, 'rules made in ISPConfig are kept');
        $this->assertStringContainsString(MailRules::BEGIN, $sieve);
        $this->assertStringContainsString('if header :contains ["from", "sender"] "acme.com" {'."\n".'  fileinto :create "Junk";', $sieve);
        // Quotes escaped for Sieve; typed wildcards matched literally.
        $this->assertStringContainsString('header :matches "subject" "Sale \\"50%\\" \\\\*now\\\\**" {'."\n".'  discard;'."\n".'  stop;', $sieve);
        $this->assertStringContainsString('not anyof (header :is ["X-Spam", "X-Spam-Flag"] "Yes"', $sieve);

        // Pausing the last rules removes them; deleting all removes our block entirely.
        $this->withHeader('X-Greenmail-Token', $token)->putJson("/api/v1/greenmail/rules/{$rule['id']}", ['active' => false])->assertOk()->assertJsonPath('message', 'Rule paused.');
        $this->assertStringNotContainsString('discard', $this->remote()['custom_mailfilter']);

        foreach ($this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/rules?kind=filter')->json('rules') as $each) {
            $this->withHeader('X-Greenmail-Token', $token)->deleteJson("/api/v1/greenmail/rules/{$each['id']}")->assertOk();
        }
        $this->assertSame("### BEGIN FILTER_ID:7\nif header :contains \"subject\" \"x\" { stop; }\n### END FILTER_ID:7", $this->remote()['custom_mailfilter']);
    }

    public function test_automation_forwards_and_auto_replies_and_pauses_auto_replies_during_vacation(): void
    {
        $token = $this->token();

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/rules', ['kind' => 'automation', 'field' => 'any', 'action' => 'forward', 'target' => 'caleb@calebadeleye.com'])
            ->assertStatus(422)->assertJsonValidationErrors('target');
        // A filter action isn't an automation action.
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/rules', ['kind' => 'automation', 'field' => 'any', 'action' => 'delete'])
            ->assertStatus(422)->assertJsonValidationErrors('action');

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/rules', ['kind' => 'automation', 'field' => 'to', 'operator' => 'is', 'value' => 'sales@calebadeleye.com', 'action' => 'forward', 'target' => 'Team@Example.com'])->assertCreated();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/rules', ['kind' => 'automation', 'field' => 'subject', 'value' => 'quote', 'action' => 'auto_reply', 'reply_subject' => 'Thanks', 'reply_text' => "We got it.\nSpeak soon."])->assertCreated();

        $sieve = $this->remote()['custom_mailfilter'];
        $this->assertStringContainsString('if address :is ["to", "cc"] "sales@calebadeleye.com" {'."\n".'  redirect :copy "team@example.com";', $sieve);
        $this->assertStringContainsString('if header :contains "subject" "quote" {'."\n".'  vacation :days 1 :subject "Thanks" :addresses ["caleb@calebadeleye.com"] "We got it.'."\nSpeak soon.\";", $sieve);
        $this->assertStringNotContainsString('currentdate', $sieve);

        // Vacation on: ISPConfig's autoresponder, in the server's zone; auto-reply rules step aside meanwhile.
        $this->withHeader('X-Greenmail-Token', $token)->putJson('/api/v1/greenmail/vacation', ['enabled' => true, 'subject' => 'Away "now"', 'message' => 'Back Monday.', 'starts_at' => '2030-01-01T00:00:00+01:00', 'ends_at' => '2030-01-10T23:59:00+01:00'])
            ->assertOk()->assertJsonPath('vacation.enabled', true)->assertJsonPath('vacation.ends_at', '2030-01-10T23:59:00+01:00');

        $remote = $this->remote();
        $this->assertSame('y', $remote['autoresponder']);
        $this->assertSame('Away ”now”', $remote['autoresponder_subject']);
        $this->assertSame('2030-01-01 00:00:00', $remote['autoresponder_start_date']);
        $this->assertStringContainsString('if not allof (currentdate :value "ge" "iso8601" "2030-01-01T00:00:00", currentdate :value "le" "iso8601" "2030-01-10T23:59:00") {', $remote['custom_mailfilter']);

        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/vacation')->assertJsonPath('vacation.message', 'Back Monday.');

        $this->withHeader('X-Greenmail-Token', $token)->putJson('/api/v1/greenmail/vacation', ['enabled' => false])->assertOk()->assertJsonPath('vacation.enabled', false);
        $this->assertSame('n', $this->remote()['autoresponder']);
        $this->assertStringNotContainsString('currentdate', $this->remote()['custom_mailfilter']);
    }

    public function test_send_later_goes_out_when_due_and_lands_in_sent(): void
    {
        $token = $this->token();

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/scheduled', ['to' => 'ada@example.com', 'bcc' => 'boss@example.com', 'subject' => 'Later', 'html' => '<p>Hi</p>', 'send_at' => now()->subMinute()->toIso8601String()])
            ->assertStatus(422)->assertJsonValidationErrors('send_at');

        $id = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/scheduled', ['to' => 'ada@example.com', 'bcc' => 'boss@example.com', 'subject' => 'Later', 'html' => '<p>Hi</p>', 'send_at' => now()->addHour()->toIso8601String()])
            ->assertCreated()->json('scheduled.id');
        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/scheduled')->assertJsonCount(1, 'scheduled')->assertJsonMissingPath('scheduled.0.password_encrypted');

        $this->artisan('greenmail:dispatch')->assertSuccessful();
        $this->assertCount(0, $this->sent, 'not due yet');

        $this->travel(2)->hours();
        $this->artisan('greenmail:dispatch')->assertSuccessful();

        $this->assertCount(1, $this->sent);
        $this->assertEqualsCanonicalizing(['ada@example.com', 'boss@example.com'], array_map(fn ($a) => $a->getAddress(), $this->sent[0]['envelope']->getRecipients()));
        $this->assertStringNotContainsString('boss@example.com', $this->sent[0]['message']->toString(), 'Bcc stays hidden');
        $item = GreenmailScheduledMessage::findOrFail($id);
        $this->assertSame('sent', $item->status);
        $this->assertNull($item->password_encrypted);
        Storage::disk('local')->assertMissing($item->raw_path);

        $this->mail->open('caleb@calebadeleye.com', 'mailbox-pass');
        $this->assertSame(1, $this->mail->messages('Sent', 1, 10)['total']);
    }

    public function test_a_scheduled_email_can_be_cancelled(): void
    {
        $token = $this->token();
        $id = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/scheduled', ['to' => 'ada@example.com', 'subject' => 'Later', 'html' => '<p>Hi</p>', 'send_at' => now()->addHour()->toIso8601String()])->json('scheduled.id');

        $this->withHeader('X-Greenmail-Token', $token)->deleteJson("/api/v1/greenmail/scheduled/{$id}")->assertOk()->assertJsonPath('message', 'Scheduled email cancelled.');
        $this->travel(2)->hours();
        $this->artisan('greenmail:dispatch');
        $this->assertCount(0, $this->sent);
    }

    public function test_campaigns_send_personalised_emails_a_few_a_minute_and_honour_unsubscribes(): void
    {
        config(['greenmail.campaign_per_minute' => 2]);
        $token = $this->token();
        $contact = GreenmailContact::query()->create(['owner_email' => 'caleb@calebadeleye.com', 'email' => 'tolu@example.com', 'name' => 'Tolu Ade']);

        $campaign = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/campaigns', [
            'name' => 'October news',
            'subject' => 'News for {{first_name}}',
            'body_html' => '<p>Hello {{name}} ({{email}})</p><script>x</script>',
            'recipients' => [['email' => 'Ada@Example.com', 'name' => 'Ada Obi'], ['email' => 'ada@example.com'], ['email' => 'gone@example.com'], ['email' => 'caleb@calebadeleye.com']],
            'contact_ids' => [$contact->id],
        ])->assertCreated()->assertJsonPath('campaign.total', 3)->assertJsonPath('campaign.status', 'draft')->json('campaign');
        $this->assertStringNotContainsString('<script>', $campaign['body_html']);

        GreenmailUnsubscribe::query()->create(['owner_email' => 'caleb@calebadeleye.com', 'email' => 'gone@example.com']);

        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/test")->assertOk();
        $this->assertSame(['caleb@calebadeleye.com'], array_map(fn ($a) => $a->getAddress(), $this->sent[0]['message']->getTo()));
        $this->sent = [];

        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/send")->assertOk()->assertJsonPath('campaign.status', 'sending');

        // Two a minute: Ada is sent; gone@ unsubscribed earlier, so skipped.
        $this->artisan('greenmail:dispatch');
        $this->assertCount(1, $this->sent);
        /** @var Email $first */
        $first = $this->sent[0]['message'];
        $this->assertSame('News for Ada', $first->getSubject());
        $this->assertStringContainsString('Hello Ada Obi (ada@example.com)', $first->getHtmlBody());
        $this->assertStringContainsString('/api/v1/greenmail/unsubscribe/', $first->getHeaders()->get('List-Unsubscribe')->getBodyAsString());

        $this->artisan('greenmail:dispatch');
        $this->assertCount(2, $this->sent);
        $this->assertSame('News for Tolu', $this->sent[1]['message']->getSubject());
        $done = GreenmailCampaign::findOrFail($campaign['id']);
        $this->assertSame('sent', $done->status);
        $this->assertSame([2, 0, 1], [$done->sent_count, $done->failed_count, $done->skipped_count]);
        $this->assertNull($done->password_encrypted);

        // The unsubscribe link: opening it asks; confirming records it.
        $recipient = GreenmailCampaignRecipient::query()->where('email', 'tolu@example.com')->firstOrFail();
        $this->get('/api/v1/greenmail/unsubscribe/'.$recipient->unsubscribeToken())->assertOk()->assertSee('Unsubscribe tolu@example.com');
        $this->assertFalse(GreenmailUnsubscribe::query()->where('email', 'tolu@example.com')->exists());
        $this->post('/api/v1/greenmail/unsubscribe/'.$recipient->unsubscribeToken())->assertOk()->assertSee('will not get these emails');
        $this->assertTrue(GreenmailUnsubscribe::query()->where('email', 'tolu@example.com')->exists());
        $this->get('/api/v1/greenmail/unsubscribe/'.$recipient->id.'.forged')->assertNotFound();
    }

    public function test_a_campaign_waits_out_the_mail_servers_hourly_limit_instead_of_failing_everyone(): void
    {
        config(['greenmail.campaign_per_minute' => 10, 'greenmail.campaign_hourly_limit' => 40]);
        // The mail server accepts two, then answers like rspamd's ratelimit does.
        $accepted = 0;
        $this->app->instance(MailSender::class, new class($accepted) extends MailSender
        {
            public function __construct(private int &$accepted) {}

            protected function transmit(RawMessage $message, ?Envelope $envelope, string $username, string $password): void
            {
                if ($this->accepted >= 2) {
                    throw new \Symfony\Component\Mailer\Exception\TransportException('Expected response code "250" but got code "451", with message "451 4.7.1 Ratelimit "user" exceeded".');
                }
                $this->accepted++;
            }
        });

        $token = $this->token();
        $campaign = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/campaigns', [
            'name' => 'Welcome', 'subject' => 'Hi', 'body_html' => '<p>Hello</p>',
            'recipients' => collect(range(1, 5))->map(fn ($i) => ['email' => "r{$i}@example.com"])->all(),
        ])->assertCreated()->json('campaign');
        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/send")->assertOk();

        $this->artisan('greenmail:dispatch');
        $c = GreenmailCampaign::findOrFail($campaign['id']);
        $this->assertSame(['sending', 2, 0], [$c->status, $c->sent_count, $c->failed_count]);
        $this->assertSame(3, $c->recipients()->where('status', 'pending')->count());
        $this->assertTrue($c->send_at->isFuture(), 'it pauses before trying again');
        $this->assertStringContainsString('an hour', (string) $c->last_error);

        // Paused: nothing is tried until the pause is over; then the rest go out.
        $this->artisan('greenmail:dispatch');
        $this->assertSame(2, $accepted);
        $accepted = -10;
        $this->travel(16)->minutes();
        $this->artisan('greenmail:dispatch');
        $c->refresh();
        $this->assertSame(['sent', 5, 0], [$c->status, $c->sent_count, $c->failed_count]);

        // Our own hourly cap: past it, the campaign waits rather than calling the server.
        config(['greenmail.campaign_hourly_limit' => 5]);
        $second = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/campaigns', [
            'name' => 'More', 'subject' => 'Hi', 'body_html' => '<p>Hello</p>', 'recipients' => [['email' => 'x@example.com']],
        ])->json('campaign');
        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$second['id']}/send")->assertOk();
        $this->artisan('greenmail:dispatch');
        $this->assertSame(1, GreenmailCampaign::findOrFail($second['id'])->recipients()->where('status', 'pending')->count());
    }

    public function test_failed_recipients_of_a_finished_campaign_can_be_sent_again(): void
    {
        $token = $this->token();
        $campaign = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/campaigns', [
            'name' => 'Welcome', 'subject' => 'Hi', 'body_html' => '<p>Hello</p>',
            'recipients' => [['email' => 'a@example.com'], ['email' => 'b@example.com']],
        ])->json('campaign');
        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/retry")->assertStatus(422);

        $c = GreenmailCampaign::findOrFail($campaign['id']);
        $c->update(['status' => 'sent', 'sent_count' => 1, 'failed_count' => 1, 'finished_at' => now()]);
        $c->recipients()->where('email', 'a@example.com')->update(['status' => 'sent', 'sent_at' => now()]);
        $c->recipients()->where('email', 'b@example.com')->update(['status' => 'failed', 'error' => '451 4.7.1 Ratelimit']);

        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/retry")
            ->assertOk()->assertJsonPath('campaign.status', 'sending')->assertJsonPath('message', fn ($m) => str_contains($m, '1 recipient'));
        $this->artisan('greenmail:dispatch');

        $this->assertSame(['b@example.com'], collect($this->sent)->flatMap(fn ($s) => array_map(fn ($a) => $a->getAddress(), $s['message']->getTo()))->all());
        $c->refresh();
        $this->assertSame(['sent', 2, 0], [$c->status, $c->sent_count, $c->failed_count]);
        $this->withHeader('X-Greenmail-Token', 'gm_nope')->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/retry")->assertUnauthorized();
    }

    public function test_campaign_reports_count_opens_clicks_and_unsubscribes(): void
    {
        $token = $this->token();
        $campaign = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/campaigns', [
            'name' => 'Launch', 'subject' => 'Hi {{first_name}}',
            'body_html' => '<p>Hello</p><p><a href="https://example.com/offer?a=1&amp;b=2">Offer</a> <a href="https://example.com/offer?a=1&amp;b=2">again</a> <a href="mailto:x@example.com">mail</a> <a href="https://shop.example.com/">Shop</a></p>',
            'recipients' => [['email' => 'ada@example.com', 'name' => 'Ada Obi'], ['email' => 'bola@example.com'], ['email' => 'chi@example.com']],
        ])->assertCreated()->assertJsonPath('campaign.track', true)->json('campaign');
        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/send")->assertOk();
        $this->artisan('greenmail:dispatch');
        $this->assertCount(3, $this->sent);

        /** @var Email $email */
        $email = $this->sent[0]['message'];
        $html = $email->getHtmlBody();
        $this->assertStringNotContainsString('https://example.com/offer', $html, 'links go through Green Mail');
        $this->assertStringContainsString('mailto:x@example.com', $html);
        $this->assertStringContainsString('/api/v1/greenmail/unsubscribe/', $html, 'the unsubscribe link is not tracked');
        preg_match('#/api/v1/greenmail/t/o/([0-9]+\.[0-9a-f]{24})\.gif#', $html, $pixel);
        preg_match_all('#/api/v1/greenmail/t/c/([0-9]+\.[0-9a-f]{24})/([0-9]+)#', $html, $links, PREG_SET_ORDER);
        $this->assertNotEmpty($pixel);
        $this->assertCount(3, $links, 'two tracked offer links (same link) and the shop link');
        $this->assertSame($links[0][2], $links[1][2]);
        $ada = $pixel[1];

        // Ada opens twice and clicks the offer twice; Bola clicks the shop with pictures blocked.
        $this->get("/api/v1/greenmail/t/o/{$ada}.gif")->assertOk()->assertHeader('Content-Type', 'image/gif');
        $this->get("/api/v1/greenmail/t/o/{$ada}.gif")->assertOk();
        $this->get("/api/v1/greenmail/t/c/{$ada}/{$links[0][2]}")->assertRedirect('https://example.com/offer?a=1&b=2');
        $this->get("/api/v1/greenmail/t/c/{$ada}/{$links[0][2]}")->assertRedirect();
        preg_match_all('#/api/v1/greenmail/t/c/([0-9]+\.[0-9a-f]{24})/([0-9]+)#', $this->sent[1]['message']->getHtmlBody(), $bolaLinks, PREG_SET_ORDER);
        $this->get("/api/v1/greenmail/t/c/{$bolaLinks[2][1]}/{$bolaLinks[2][2]}")->assertRedirect('https://shop.example.com/');
        // A mail scanner following every link isn't a person.
        $this->withHeader('User-Agent', 'Mimecast URL protect')->get("/api/v1/greenmail/t/c/{$bolaLinks[0][1]}/{$bolaLinks[0][2]}")->assertRedirect();
        $this->withHeader('User-Agent', 'Mozilla/5.0');
        // Forged tokens and other campaigns' links go nowhere.
        $this->get("/api/v1/greenmail/t/c/{$ada}/999999")->assertNotFound();
        $this->get('/api/v1/greenmail/t/c/'.explode('.', $ada)[0].'.000000000000000000000000/'.$links[0][2])->assertNotFound();
        $this->get('/api/v1/greenmail/t/o/'.explode('.', $ada)[0].'.000000000000000000000000.gif')->assertOk();

        // Chi unsubscribes.
        $chi = GreenmailCampaignRecipient::query()->where('email', 'chi@example.com')->firstOrFail();
        $this->post('/api/v1/greenmail/unsubscribe/'.$chi->unsubscribeToken())->assertOk();

        $report = $this->withHeader('X-Greenmail-Token', $token)->getJson("/api/v1/greenmail/campaigns/{$campaign['id']}")->assertOk()->json('campaign');
        $r = $report['report'];
        $this->assertSame([3, 2, 3, 2, 3, 1], [$r['sent'], $r['opened'], $r['opens'], $r['clicked'], $r['clicks'], $r['unsubscribed']]);
        $this->assertEquals(66.7, $r['open_rate']);
        $this->assertEquals(100, $r['click_to_open_rate']);
        $this->assertSame([['url' => 'https://example.com/offer?a=1&b=2', 'clicks' => 2, 'people' => 1], ['url' => 'https://shop.example.com/', 'clicks' => 1, 'people' => 1]], array_map(fn ($l) => array_diff_key($l, ['id' => 1]), $r['links']));
        $this->assertSame('hour', $r['timeline']['unit']);
        $this->assertSame(2, array_sum(array_column($r['timeline']['points'], 'opens')));
        $byEmail = collect($report['recipients'])->keyBy('email');
        $this->assertSame([2, 2], [$byEmail['ada@example.com']['open_count'], $byEmail['ada@example.com']['click_count']]);
        $this->assertNotNull($byEmail['bola@example.com']['opened_at'], 'a click counts as an open');
        $this->assertNotNull($byEmail['chi@example.com']['unsubscribed_at']);

        $list = $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/campaigns')->json('campaigns.0');
        $this->assertSame([2, 2], [$list['opened_count'], $list['clicked_count']]);
    }

    public function test_a_campaign_can_be_sent_without_tracking(): void
    {
        $token = $this->token();
        $campaign = $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/campaigns', [
            'name' => 'Plain', 'subject' => 'Hi', 'body_html' => '<p><a href="https://example.com/">Site</a></p>', 'track' => false,
            'recipients' => [['email' => 'ada@example.com']],
        ])->assertCreated()->assertJsonPath('campaign.track', false)->json('campaign');
        $this->withHeader('X-Greenmail-Token', $token)->postJson("/api/v1/greenmail/campaigns/{$campaign['id']}/send")->assertOk();
        $this->artisan('greenmail:dispatch');

        $html = $this->sent[0]['message']->getHtmlBody();
        $this->assertStringContainsString('href="https://example.com/"', $html);
        $this->assertStringNotContainsString('/greenmail/t/', $html);
    }

    public function test_template_placeholders_in_an_ordinary_email_use_the_recipients_name(): void
    {
        $token = $this->token();
        GreenmailContact::query()->create(['owner_email' => 'caleb@calebadeleye.com', 'email' => 'ada@example.com', 'name' => 'Ada Obi']);

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/send', ['to' => 'Ada@Example.com', 'subject' => 'For {{first_name}}', 'html' => '<p>Hi {{name}}</p>'])->assertCreated();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/send', ['to' => 'new@example.com', 'subject' => 'Hello', 'html' => '<p>Hi {{first_name}}</p>'])->assertCreated();

        $this->assertSame('For Ada', $this->sent[0]['message']->getSubject());
        $this->assertStringContainsString('Hi Ada Obi', $this->sent[0]['message']->getHtmlBody());
        $this->assertStringContainsString('Hi there', $this->sent[1]['message']->getHtmlBody());
    }

    public function test_check_reports_new_unread_inbox_mail_since_the_last_one_seen(): void
    {
        $token = $this->token();
        $first = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Old one']);

        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/check')->assertOk()->assertJsonPath('latest_uid', $first)->assertJsonCount(0, 'new');

        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Fresh one']);
        $this->withHeader('X-Greenmail-Token', $token)->getJson("/api/v1/greenmail/check?since={$first}")->assertOk()
            ->assertJsonCount(1, 'new')->assertJsonPath('new.0.subject', 'Fresh one');
    }
}
