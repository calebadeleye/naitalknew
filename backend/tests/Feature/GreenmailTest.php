<?php

namespace Tests\Feature;

use App\Models\Greenmail\GreenmailContact;
use App\Models\Greenmail\GreenmailSession;
use App\Services\Greenmail\FakeMailGateway;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\MailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Mime\Email;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class GreenmailTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private FakeMailGateway $mail;

    /** @var array<int, array{message: Email, username: string, password: string}> */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->mail = new FakeMailGateway;
        $this->mail->addAccount('caleb@calebadeleye.com', 'mailbox-pass');
        $this->mail->addAccount('other@example.com', 'other-pass');
        $this->app->instance(MailGateway::class, $this->mail);

        $sent = &$this->sent;
        $this->app->instance(MailSender::class, new class($sent) extends MailSender
        {
            public function __construct(private array &$log) {}

            protected function deliver(Email $message, string $username, string $password): void
            {
                $this->log[] = ['message' => $message, 'username' => $username, 'password' => $password];
            }
        });
    }

    private function signIn(string $email = 'caleb@calebadeleye.com', string $password = 'mailbox-pass'): string
    {
        return $this->postJson('/api/v1/greenmail/session', ['email' => $email, 'password' => $password])->assertCreated()->json('token');
    }

    private function gm(string $token): static
    {
        return $this->withHeader('X-Greenmail-Token', $token);
    }

    public function test_sign_in_checks_the_mailbox_password_and_stores_it_only_encrypted(): void
    {
        $this->postJson('/api/v1/greenmail/session', ['email' => 'caleb@calebadeleye.com', 'password' => 'wrong'])
            ->assertStatus(422)->assertJsonValidationErrors('email');

        $token = $this->signIn('Caleb@CalebAdeleye.com');

        $this->assertStringStartsWith('gm_', $token);
        $session = GreenmailSession::firstOrFail();
        $this->assertSame('caleb@calebadeleye.com', $session->email);
        $this->assertStringNotContainsString('mailbox-pass', $session->password_encrypted);
        $this->assertNotSame($token, $session->token_hash);
        $this->assertSame('mailbox-pass', $session->password());
    }

    public function test_repeated_wrong_passwords_are_throttled(): void
    {
        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/v1/greenmail/session', ['email' => 'caleb@calebadeleye.com', 'password' => "guess-{$attempt}"])->assertStatus(422);
        }

        $this->postJson('/api/v1/greenmail/session', ['email' => 'caleb@calebadeleye.com', 'password' => 'mailbox-pass'])->assertStatus(429);
    }

    public function test_the_api_needs_a_valid_token_and_signing_out_ends_it(): void
    {
        $this->getJson('/api/v1/greenmail/folders')->assertUnauthorized();
        $this->withHeader('X-Greenmail-Token', 'gm_made-up')->getJson('/api/v1/greenmail/folders')->assertUnauthorized();

        $token = $this->signIn();
        $this->gm($token)->getJson('/api/v1/greenmail/session')->assertOk()->assertJsonPath('email', 'caleb@calebadeleye.com');
        $this->gm($token)->deleteJson('/api/v1/greenmail/session')->assertOk();
        $this->gm($token)->getJson('/api/v1/greenmail/folders')->assertUnauthorized();
    }

    public function test_an_idle_session_expires_and_a_changed_password_signs_the_browser_out(): void
    {
        $token = $this->signIn();
        GreenmailSession::query()->update(['last_used_at' => now()->subMinutes(config('greenmail.session_idle_minutes') + 1)]);
        $this->gm($token)->getJson('/api/v1/greenmail/folders')->assertUnauthorized();
        $this->assertSame(0, GreenmailSession::count());

        $token = $this->signIn();
        $this->mail->accounts['caleb@calebadeleye.com'] = 'changed-elsewhere';
        $this->gm($token)->getJson('/api/v1/greenmail/folders')->assertUnauthorized()->assertJsonPath('message', 'Your mailbox password has changed. Please sign in again.');
        $this->assertSame(0, GreenmailSession::count());
    }

    public function test_folders_come_in_a_familiar_order_and_the_list_can_be_filtered_and_searched(): void
    {
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Website Update', 'text' => 'The new design looks great']);
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Domain renewal', 'seen' => true, 'flagged' => true]);
        $token = $this->signIn();

        $roles = collect($this->gm($token)->getJson('/api/v1/greenmail/folders')->assertOk()->json('folders'))->pluck('role')->all();
        $this->assertSame(['inbox', 'sent', 'drafts', 'junk', 'trash'], $roles);

        $this->gm($token)->getJson('/api/v1/greenmail/messages?folder=INBOX')->assertOk()->assertJsonPath('total', 2)->assertJsonPath('messages.0.subject', 'Domain renewal');
        $this->gm($token)->getJson('/api/v1/greenmail/messages?folder=INBOX&filter=unread')->assertJsonPath('total', 1)->assertJsonPath('messages.0.subject', 'Website Update');
        $this->gm($token)->getJson('/api/v1/greenmail/messages?folder=INBOX&filter=flagged')->assertJsonPath('messages.0.subject', 'Domain renewal');
        $this->gm($token)->getJson('/api/v1/greenmail/messages?folder=INBOX&q=design')->assertJsonPath('total', 1);
    }

    public function test_reading_cleans_the_html_inlines_cid_images_and_marks_it_read(): void
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        $uid = $this->mail->deliver('caleb@calebadeleye.com', [
            'subject' => 'Hello',
            'html' => '<p onclick="steal()">Hi <b>Caleb</b></p><script>alert(1)</script><img src="cid:logo123"><img src="https://tracker.example/pixel.gif"><a href="https://example.com">site</a>',
            'attachments' => [
                ['name' => 'logo.png', 'mime' => 'image/png', 'content' => $png, 'content_id' => 'logo123', 'inline' => true],
                ['name' => 'brief.pdf', 'mime' => 'application/pdf', 'content' => '%PDF-1.4'],
            ],
        ]);
        $token = $this->signIn();

        $message = $this->gm($token)->getJson("/api/v1/greenmail/messages/{$uid}?folder=INBOX")->assertOk()->json();

        $this->assertStringNotContainsString('<script', $message['html']);
        $this->assertStringNotContainsString('onclick', $message['html']);
        $this->assertStringContainsString('data:image/png;base64,'.base64_encode($png), $message['html']);
        $this->assertStringContainsString('target="_blank"', $message['html']);
        $this->assertTrue($message['has_remote_images']);
        $this->assertSame(['brief.pdf'], array_column($message['attachments'], 'name'), 'inline images are not listed as attachments');
        $this->assertTrue($this->mail->mailboxes['caleb@calebadeleye.com']['INBOX'][$uid]['seen']);

        $this->gm($token)->get("/api/v1/greenmail/messages/{$uid}/attachments/1?folder=INBOX")->assertOk()->assertSee('%PDF-1.4', false)->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_flag_archive_spam_and_delete_move_mail_to_the_right_folders(): void
    {
        $a = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'A']);
        $b = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'B']);
        $c = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'C']);
        $token = $this->signIn();
        $box = fn () => $this->mail->mailboxes['caleb@calebadeleye.com'];

        $this->gm($token)->patchJson("/api/v1/greenmail/messages/{$a}", ['folder' => 'INBOX', 'flagged' => true])->assertOk();
        $this->assertTrue($box()['INBOX'][$a]['flagged']);

        $this->gm($token)->postJson("/api/v1/greenmail/messages/{$a}/move", ['folder' => 'INBOX', 'to_role' => 'archive'])->assertOk()->assertJsonPath('to', 'Archive');
        $this->gm($token)->postJson("/api/v1/greenmail/messages/{$b}/move", ['folder' => 'INBOX', 'to_role' => 'junk'])->assertOk()->assertJsonPath('to', 'Junk');
        $this->gm($token)->deleteJson("/api/v1/greenmail/messages/{$c}?folder=INBOX")->assertOk()->assertJsonPath('message', 'Moved to Trash.');

        $this->assertArrayHasKey($a, $box()['Archive']);
        $this->assertArrayHasKey($b, $box()['Junk']);
        $this->assertArrayHasKey($c, $box()['Trash']);

        $this->gm($token)->deleteJson("/api/v1/greenmail/messages/{$c}?folder=Trash")->assertOk()->assertJsonPath('message', 'Deleted for good.');
        $this->assertArrayNotHasKey($c, $box()['Trash']);
    }

    public function test_sending_uses_the_mailbox_login_keeps_a_sent_copy_and_remembers_recipients(): void
    {
        $original = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Website Update', 'message_id' => '<abc@elinth.test>']);
        $token = $this->signIn();
        $this->gm($token)->putJson('/api/v1/greenmail/settings', ['display_name' => 'Caleb Adeleye', 'signature_html' => '<p>Caleb<script>x()</script></p>'])
            ->assertOk()->assertJsonPath('signature_html', '<p>Caleb</p>');

        $this->gm($token)->post('/api/v1/greenmail/send', [
            'to' => 'chidi@elinthgroup.com, team@elinthgroup.com',
            'subject' => 'Re: Website Update',
            'html' => '<p>Thanks — preview by Friday.</p>',
            'in_reply_to' => '<abc@elinth.test>',
            'reply_uid' => $original,
            'reply_folder' => 'INBOX',
            'attachments' => [UploadedFile::fake()->createWithContent('plan.txt', 'the plan')],
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertCount(1, $this->sent);
        ['message' => $message, 'username' => $username, 'password' => $password] = $this->sent[0];
        $this->assertSame(['caleb@calebadeleye.com', 'mailbox-pass'], [$username, $password]);
        $this->assertSame('Caleb Adeleye', $message->getFrom()[0]->getName());
        $this->assertSame(['chidi@elinthgroup.com', 'team@elinthgroup.com'], array_map(fn ($a) => $a->getAddress(), $message->getTo()));
        $this->assertSame('<abc@elinth.test>', $message->getHeaders()->get('In-Reply-To')->getBodyAsString());
        $this->assertSame('plan.txt', $message->getAttachments()[0]->getFilename());

        $this->assertSame('Sent', $this->mail->appended[0]['folder']);
        $this->assertSame(['\\Seen'], $this->mail->appended[0]['flags']);
        $this->assertEqualsCanonicalizing(['chidi@elinthgroup.com', 'team@elinthgroup.com'], GreenmailContact::pluck('email')->all());
    }

    public function test_forwarding_carries_the_original_attachments_the_sender_kept(): void
    {
        $original = $this->mail->deliver('caleb@calebadeleye.com', [
            'subject' => 'Contract',
            'attachments' => [
                ['name' => 'contract.pdf', 'mime' => 'application/pdf', 'content' => '%PDF-contract'],
                ['name' => 'notes.txt', 'mime' => 'text/plain', 'content' => 'private notes'],
            ],
        ]);
        $token = $this->signIn();

        $this->gm($token)->post('/api/v1/greenmail/send', [
            'to' => 'lawyer@example.com',
            'subject' => 'Fwd: Contract',
            'html' => '<p>See attached.</p>',
            'forward_folder' => 'INBOX',
            'forward_uid' => $original,
            'forward_attachments' => [0], // the sender removed notes.txt
        ], ['Accept' => 'application/json'])->assertCreated();

        $attachments = $this->sent[0]['message']->getAttachments();
        $this->assertCount(1, $attachments);
        $this->assertSame('contract.pdf', $attachments[0]->getFilename());
        $this->assertSame('%PDF-contract', $attachments[0]->getBody());
        $this->assertStringContainsString('contract.pdf', $this->mail->appended[0]['raw'], 'the Sent copy has it too');
    }

    public function test_sending_needs_a_valid_recipient(): void
    {
        $token = $this->signIn();

        $this->gm($token)->postJson('/api/v1/greenmail/send', ['to' => '', 'subject' => 'x', 'html' => 'y'])->assertStatus(422)->assertJsonValidationErrors('to');
        $this->gm($token)->postJson('/api/v1/greenmail/send', ['to' => 'not-an-address', 'subject' => 'x', 'html' => 'y'])->assertStatus(422);
        $this->assertCount(0, $this->sent);
    }

    public function test_a_draft_can_be_saved_before_any_recipient_is_added(): void
    {
        $token = $this->signIn();

        $this->gm($token)->post('/api/v1/greenmail/drafts', ['to' => '', 'cc' => '', 'bcc' => '', 'subject' => 'Ideas', 'html' => '<p>half-written</p>'], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame('Drafts', $this->mail->appended[0]['folder']);
        $this->assertStringContainsString('Subject: Ideas', $this->mail->appended[0]['raw']);
    }

    public function test_spam_can_be_emptied_but_the_inbox_cannot(): void
    {
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Win a prize'], 'Junk');
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Cheap pills'], 'Junk');
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Real mail']);
        $token = $this->signIn();

        $this->gm($token)->postJson('/api/v1/greenmail/folders/empty', ['folder' => 'Junk'])->assertOk()->assertJsonPath('deleted', 2);
        $this->assertSame([], $this->mail->mailboxes['caleb@calebadeleye.com']['Junk']);

        $this->gm($token)->postJson('/api/v1/greenmail/folders/empty', ['folder' => 'INBOX'])->assertStatus(422);
        $this->assertCount(1, $this->mail->mailboxes['caleb@calebadeleye.com']['INBOX']);
    }

    public function test_several_messages_can_be_handled_at_once_and_starred_mail_is_counted(): void
    {
        $a = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'A', 'flagged' => true]);
        $b = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'B', 'flagged' => true]);
        $c = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'C']);
        $token = $this->signIn();
        $box = fn () => $this->mail->mailboxes['caleb@calebadeleye.com'];

        $this->gm($token)->getJson('/api/v1/greenmail/folders')->assertJsonPath('starred', 2);

        $this->gm($token)->postJson('/api/v1/greenmail/messages/bulk', ['folder' => 'INBOX', 'uids' => [$a, $c], 'action' => 'read'])->assertOk();
        $this->assertTrue($box()['INBOX'][$a]['seen'] && $box()['INBOX'][$c]['seen']);
        $this->assertFalse($box()['INBOX'][$b]['seen']);

        $this->gm($token)->postJson('/api/v1/greenmail/messages/bulk', ['folder' => 'INBOX', 'uids' => [$a, $b], 'action' => 'delete'])
            ->assertOk()->assertJsonPath('message', '2 messages moved to Trash.');
        $this->assertSame([$c], array_keys($box()['INBOX']));
        $this->assertEqualsCanonicalizing([$a, $b], array_keys($box()['Trash']));

        $this->gm($token)->postJson('/api/v1/greenmail/messages/bulk', ['folder' => 'Trash', 'uids' => [$a, $b], 'action' => 'delete'])
            ->assertOk()->assertJsonPath('message', '2 messages deleted for good.');
        $this->assertSame([], $box()['Trash']);
    }

    public function test_a_signature_image_is_uploaded_and_publicly_viewable(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        $token = $this->signIn();

        $url = $this->gm($token)->post('/api/v1/greenmail/settings/signature-image', ['image' => UploadedFile::fake()->image('me.png', 120, 120)], ['Accept' => 'application/json'])
            ->assertCreated()->json('url');

        $this->assertMatchesRegularExpression('#/api/v1/greenmail/signature-images/[a-f0-9]{64}/[A-Za-z0-9]{32}\.png$#', $url);
        // No sign-in needed — the recipient's mail app loads it.
        $this->app['auth']->forgetGuards();
        $this->get(parse_url($url, PHP_URL_PATH))->assertOk();
        $this->get('/api/v1/greenmail/signature-images/'.str_repeat('a', 64).'/../../.env')->assertNotFound();

        $this->gm($token)->post('/api/v1/greenmail/settings/signature-image', ['image' => UploadedFile::fake()->create('evil.php', 10, 'application/x-php')], ['Accept' => 'application/json'])
            ->assertStatus(422);
    }

    public function test_calendar_events_are_listed_by_range_and_stored_in_utc(): void
    {
        $token = $this->signIn();
        $base = '/api/v1/greenmail/events';

        $this->gm($token)->postJson($base, ['title' => 'Client call', 'starts_at' => '2026-10-20T12:00:00+01:00', 'ends_at' => '2026-10-20T12:30:00+01:00', 'location' => 'Google Meet'])
            ->assertCreated()->assertJsonPath('event.title', 'Client call');
        $this->assertSame('2026-10-20 11:00:00', \App\Models\Greenmail\GreenmailEvent::value('starts_at')->format('Y-m-d H:i:s'));
        $this->gm($token)->postJson($base, ['title' => 'Conference', 'starts_at' => '2026-10-19T09:00:00Z', 'ends_at' => '2026-10-21T17:00:00Z'])->assertCreated();
        $this->gm($token)->postJson($base, ['title' => 'Next month', 'starts_at' => '2026-11-20T09:00:00Z'])->assertCreated();
        $this->gm($token)->postJson($base, ['title' => 'Backwards', 'starts_at' => '2026-10-20T10:00:00Z', 'ends_at' => '2026-10-20T09:00:00Z'])
            ->assertStatus(422)->assertJsonValidationErrors('ends_at');

        // The 20th: the call, plus the conference that started the day before.
        $titles = collect($this->gm($token)->getJson("{$base}?from=2026-10-20T00:00:00Z&to=2026-10-21T00:00:00Z")->assertOk()->json('events'))->pluck('title')->all();
        $this->assertEqualsCanonicalizing(['Client call', 'Conference'], $titles);

        $id = \App\Models\Greenmail\GreenmailEvent::where('title', 'Client call')->value('id');
        $this->gm($token)->putJson("{$base}/{$id}", ['title' => 'Client call (moved)', 'starts_at' => '2026-10-20T15:00:00Z'])->assertOk()->assertJsonPath('event.title', 'Client call (moved)');

        $other = $this->signIn('other@example.com', 'other-pass');
        $this->gm($other)->getJson("{$base}?from=2026-10-01T00:00:00Z&to=2026-11-30T00:00:00Z")->assertJsonCount(0, 'events');
        $this->gm($other)->deleteJson("{$base}/{$id}")->assertNotFound();
        $this->gm($token)->deleteJson("{$base}/{$id}")->assertOk();
    }

    public function test_tasks_are_ordered_by_due_date_and_can_be_completed(): void
    {
        $token = $this->signIn();
        $base = '/api/v1/greenmail/tasks';

        $this->gm($token)->postJson($base, ['title' => 'Prepare monthly report', 'due_date' => '2026-10-17'])->assertCreated();
        $this->gm($token)->postJson($base, ['title' => 'Someday'])->assertCreated();
        $first = $this->gm($token)->postJson($base, ['title' => 'Complete client website design', 'due_date' => '2026-10-16'])->assertCreated()->json('task.id');
        $this->gm($token)->postJson($base, ['title' => 'Bad date', 'due_date' => '16/10/2026'])->assertStatus(422);

        $this->gm($token)->getJson($base)->assertOk()->assertJsonPath('tasks.0.title', 'Complete client website design')->assertJsonPath('tasks.2.title', 'Someday');

        $this->gm($token)->patchJson("{$base}/{$first}", ['done' => true])->assertOk()->assertJsonPath('task.done', true);
        $this->assertNotNull(\App\Models\Greenmail\GreenmailTask::find($first)->completed_at);
        $this->gm($token)->getJson($base)->assertJsonCount(2, 'tasks');
        $this->gm($token)->getJson("{$base}?status=done")->assertJsonCount(1, 'tasks');

        $other = $this->signIn('other@example.com', 'other-pass');
        $this->gm($other)->patchJson("{$base}/{$first}", ['done' => false])->assertNotFound();
    }

    public function test_contacts_belong_to_one_mailbox(): void
    {
        $mine = $this->signIn();
        $contact = $this->gm($mine)->postJson('/api/v1/greenmail/contacts', ['name' => 'Chidi Okafor', 'email' => 'Chidi@ElinthGroup.com'])->assertCreated()->json('contact');
        $this->assertSame('chidi@elinthgroup.com', $contact['email']);
        $this->gm($mine)->postJson('/api/v1/greenmail/contacts', ['email' => 'chidi@elinthgroup.com'])->assertStatus(422);
        $this->gm($mine)->getJson('/api/v1/greenmail/contacts?q=chidi')->assertJsonCount(1, 'contacts');

        $theirs = $this->signIn('other@example.com', 'other-pass');
        $this->gm($theirs)->getJson('/api/v1/greenmail/contacts')->assertJsonCount(0, 'contacts');
        $this->gm($theirs)->deleteJson("/api/v1/greenmail/contacts/{$contact['id']}")->assertNotFound();
    }

    public function test_the_storage_meter_falls_back_to_the_mailbox_quota_and_ispconfig_usage(): void
    {
        // This server's Dovecot reports no IMAP quota (FakeMailGateway returns none either).
        $ispConfig = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        \App\Jobs\ProvisionHostingServiceJob::dispatch($service->id);
        $email = 'caleb@'.$service->fresh()->primary_domain;
        $clientId = (int) $service->fresh()->ispConfigServiceMappings()->first()->clientMapping->ispconfig_client_id;
        $ispConfig->mailUserAdd($ispConfig->login(), $clientId, ['email' => $email]);
        $ispConfig->setMailUsageBytes($email, 300 * 1048576);
        \App\Models\MailboxRecord::query()->create(['hosting_service_id' => $service->id, 'email_address' => $email, 'quota_mb' => 1000, 'status' => 'active']);
        $this->mail->addAccount($email, 'pw-1234567');

        $this->gm($this->signIn($email, 'pw-1234567'))->getJson('/api/v1/greenmail/session')
            ->assertOk()
            ->assertJsonPath('quota.used_bytes', 300 * 1048576)
            ->assertJsonPath('quota.limit_bytes', 1000 * 1048576);
    }

    public function test_the_assistant_summarises_the_open_email(): void
    {
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test']);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => "- Chidi likes the design\n- Wants the rest next week"]]]]]])]);
        $uid = $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Website Update', 'text' => 'The new design looks great. Please send the remaining pages next week.']);
        $token = $this->signIn();

        $this->gm($token)->postJson('/api/v1/greenmail/assistant', ['action' => 'summarise', 'folder' => 'INBOX', 'uid' => $uid])
            ->assertOk()->assertJsonPath('reply', "- Chidi likes the design\n- Wants the rest next week");

        Http::assertSent(fn ($request) => str_contains(json_encode($request->data()), 'remaining pages next week'));
        $this->assertFalse($this->mail->mailboxes['caleb@calebadeleye.com']['INBOX'][$uid]['seen'], 'asking the assistant does not mark mail read');
    }
}
