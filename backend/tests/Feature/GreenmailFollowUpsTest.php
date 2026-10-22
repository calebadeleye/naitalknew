<?php

namespace Tests\Feature;

use App\Models\Greenmail\GreenmailAttachment;
use App\Models\Greenmail\GreenmailFollowUp;
use App\Models\Greenmail\GreenmailSharedFile;
use App\Models\Greenmail\GreenmailSnooze;
use App\Services\Greenmail\AttachmentIndex;
use App\Services\Greenmail\FakeMailGateway;
use App\Services\Greenmail\FollowUps;
use App\Services\Greenmail\Labels;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\MailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mime\RawMessage;
use Tests\TestCase;

/** Snooze, "remind me if nobody replies", labels, tasks from email, the attachment manager and share links. */
class GreenmailFollowUpsTest extends TestCase
{
    use RefreshDatabase;

    private const OWNER = 'caleb@calebadeleye.com';

    private FakeMailGateway $mail;

    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->mail = new FakeMailGateway;
        $this->mail->addAccount(self::OWNER, 'mailbox-pass');
        $this->mail->addAccount('other@example.com', 'other-pass');
        $this->app->instance(MailGateway::class, $this->mail);

        $sent = &$this->sent;
        $this->app->instance(MailSender::class, new class($sent) extends MailSender
        {
            public function __construct(private array &$log) {}

            protected function transmit(RawMessage $message, ?Envelope $envelope, string $username, string $password): void
            {
                $this->log[] = ['message' => $message];
            }
        });
    }

    private function gm(string $email = self::OWNER, string $password = 'mailbox-pass'): static
    {
        $token = $this->postJson('/api/v1/greenmail/session', ['email' => $email, 'password' => $password])->assertCreated()->json('token');

        return $this->withHeader('X-Greenmail-Token', $token);
    }

    private function box(string $folder): array
    {
        return $this->mail->mailboxes[self::OWNER][$folder] ?? [];
    }

    public function test_a_snoozed_email_comes_back_unread_when_its_time_comes(): void
    {
        $uid = $this->mail->deliver(self::OWNER, ['subject' => 'Contract', 'seen' => true]);
        $gm = $this->gm();

        $gm->postJson('/api/v1/greenmail/snoozes', ['folder' => 'INBOX', 'uid' => $uid, 'until' => now()->subMinute()->toIso8601String()])
            ->assertStatus(422)->assertJsonValidationErrors('until');
        $gm->postJson('/api/v1/greenmail/snoozes', ['folder' => 'INBOX', 'uid' => $uid, 'until' => now()->addDay()->toIso8601String()])->assertCreated();

        $this->assertSame([], $this->box('INBOX'));
        $this->assertCount(1, $this->box(FollowUps::SNOOZED_FOLDER));
        $gm->getJson('/api/v1/greenmail/snoozes')->assertJsonCount(1, 'snoozes')->assertJsonMissingPath('snoozes.0.password_encrypted');

        $this->artisan('greenmail:dispatch')->assertSuccessful();
        $this->assertSame([], $this->box('INBOX'), 'not due yet');

        $this->travel(25)->hours();
        $this->artisan('greenmail:dispatch')->assertSuccessful();

        $back = array_values($this->box('INBOX'));
        $this->assertCount(1, $back);
        $this->assertSame('Contract', $back[0]['subject']);
        $this->assertFalse($back[0]['seen'], 'returns unread so it is noticed');
        $snooze = GreenmailSnooze::firstOrFail();
        $this->assertSame('returned', $snooze->status);
        $this->assertNull($snooze->password_encrypted);
    }

    public function test_unsnooze_moves_the_email_back_now(): void
    {
        $uid = $this->mail->deliver(self::OWNER, ['subject' => 'Later']);
        $gm = $this->gm();
        $id = $gm->postJson('/api/v1/greenmail/snoozes', ['folder' => 'INBOX', 'uid' => $uid, 'until' => now()->addWeek()->toIso8601String()])->json('snooze.id');

        $gm->deleteJson("/api/v1/greenmail/snoozes/{$id}")->assertOk();
        $this->assertCount(1, $this->box('INBOX'));
        $this->assertSame('cancelled', GreenmailSnooze::findOrFail($id)->status);

        // Another mailbox can't touch it.
        $this->gm('other@example.com', 'other-pass')->deleteJson("/api/v1/greenmail/snoozes/{$id}")->assertNotFound();
    }

    public function test_a_reminder_is_dropped_when_a_reply_arrives_and_due_when_none_does(): void
    {
        $gm = $this->gm();

        $gm->postJson('/api/v1/greenmail/send', ['to' => 'ada@example.com', 'subject' => 'Quote for you', 'html' => '<p>Hi</p>', 'remind_at' => now()->addDays(3)->toIso8601String()])
            ->assertCreated()->assertJsonPath('message', 'Sent. We’ll remind you if nobody replies.');
        $gm->postJson('/api/v1/greenmail/send', ['to' => 'bola@example.com', 'subject' => 'Invoice 12', 'html' => '<p>Hi</p>', 'remind_at' => now()->addDays(3)->toIso8601String()])->assertCreated();

        $replied = GreenmailFollowUp::query()->where('subject', 'Quote for you')->firstOrFail();
        $silent = GreenmailFollowUp::query()->where('subject', 'Invoice 12')->firstOrFail();
        $this->assertSame(['ada@example.com'], $replied->recipients);
        $this->assertSame('waiting', $replied->status);

        $this->mail->deliver(self::OWNER, ['subject' => 'Re: Quote for you', 'from' => ['name' => 'Ada', 'email' => 'ada@example.com'], 'in_reply_to' => $replied->message_id]);

        $this->travel(4)->days();
        $this->artisan('greenmail:dispatch')->assertSuccessful();

        $this->assertSame('replied', $replied->fresh()->status);
        $this->assertSame('due', $silent->fresh()->status);
        $this->assertNull($silent->fresh()->password_encrypted);
        $gm = $this->gm(); // the session from four days ago has expired
        $gm->getJson('/api/v1/greenmail/followups')->assertJsonPath('due', 1);

        // "Remind me again later" puts it back to waiting; dismiss clears it.
        $gm->patchJson("/api/v1/greenmail/followups/{$silent->id}", ['action' => 'later', 'remind_at' => now()->addDay()->toIso8601String()])->assertOk();
        $this->assertSame('waiting', $silent->fresh()->status);
        $this->assertNotNull($silent->fresh()->password_encrypted);
        $gm->patchJson("/api/v1/greenmail/followups/{$silent->id}", ['action' => 'dismiss'])->assertOk();
        $this->assertSame('dismissed', $silent->fresh()->status);
    }

    public function test_a_reminder_can_be_set_on_an_email_already_sent(): void
    {
        $uid = $this->mail->deliver(self::OWNER, ['subject' => 'Proposal', 'to' => [['name' => null, 'email' => 'tolu@example.com']]], 'Sent');
        $gm = $this->gm();

        $gm->postJson('/api/v1/greenmail/followups', ['folder' => 'Sent', 'uid' => $uid, 'remind_at' => now()->addDay()->toIso8601String()])->assertCreated();
        $this->assertSame(['tolu@example.com'], GreenmailFollowUp::firstOrFail()->recipients);
    }

    public function test_labels_are_set_filtered_and_suggested(): void
    {
        $uid = $this->mail->deliver(self::OWNER, ['subject' => 'Invoice INV-2041 for October', 'text' => 'Please find the invoice attached.']);
        $this->mail->deliver(self::OWNER, ['subject' => 'Lunch?']);
        $gm = $this->gm();

        $gm->getJson("/api/v1/greenmail/messages/{$uid}?folder=INBOX")->assertJsonPath('suggested_label', 'invoice')->assertJsonPath('labels', []);

        $gm->patchJson("/api/v1/greenmail/messages/{$uid}", ['folder' => 'INBOX', 'labels_add' => ['invoice']])->assertOk();
        $gm->patchJson("/api/v1/greenmail/messages/{$uid}", ['folder' => 'INBOX', 'labels_add' => ['made-up']])->assertStatus(422);

        $gm->getJson('/api/v1/greenmail/messages?folder=INBOX&filter=label:invoice')->assertJsonCount(1, 'messages')->assertJsonPath('messages.0.uid', $uid);
        $gm->getJson("/api/v1/greenmail/messages/{$uid}?folder=INBOX")->assertJsonPath('labels', ['invoice'])->assertJsonPath('suggested_label', null);

        $this->assertSame('quotation', Labels::suggest('Request for quotation', '', []));
        $this->assertNull(Labels::suggest('Happy birthday', 'Cake at 4', []));
    }

    public function test_a_task_made_from_an_email_links_back_to_it(): void
    {
        $uid = $this->mail->deliver(self::OWNER, ['subject' => 'Website change request']);
        $messageId = $this->box('INBOX')[$uid]['message_id'];
        $gm = $this->gm();

        $gm->postJson('/api/v1/greenmail/tasks', ['title' => 'Update homepage', 'source_folder' => 'INBOX', 'source_message_id' => $messageId, 'source_subject' => 'Website change request'])
            ->assertCreated()->assertJsonPath('task.source_message_id', $messageId);

        // The email moved since: locate still finds it.
        $this->mail->ensureFolder('Archive');
        $this->mail->open(self::OWNER, 'mailbox-pass');
        $this->mail->move('INBOX', $uid, 'Archive');
        $newUid = array_key_first($this->box('Archive'));

        $gm->getJson('/api/v1/greenmail/messages/locate?message_id='.rawurlencode($messageId))->assertOk()->assertJson(['folder' => 'Archive', 'uid' => $newUid]);
        $gm->getJson('/api/v1/greenmail/messages/locate?message_id=%3Cgone%40x%3E')->assertNotFound();
    }

    public function test_attachments_are_classified_with_warnings(): void
    {
        $this->assertSame(['kind' => 'pdf', 'extension' => 'pdf', 'warning' => null], AttachmentIndex::classify('Invoice.PDF', 'application/pdf'));
        $this->assertStringContainsString('pretends to be a PDF', AttachmentIndex::classify('invoice.pdf.exe', 'application/octet-stream')['warning']);
        $this->assertStringContainsString('program or script', AttachmentIndex::classify('setup.exe', null)['warning']);
        $this->assertStringContainsString('macros', AttachmentIndex::classify('budget.xlsm', null)['warning']);
        $this->assertSame('spreadsheet', AttachmentIndex::classify('budget.xlsm', null)['kind']);
        $this->assertStringContainsString('different kind', AttachmentIndex::classify('scan.pdf', 'text/html')['warning']);
        $this->assertNull(AttachmentIndex::classify('photo.jpg', 'image/jpeg')['warning']);
    }

    public function test_the_attachment_manager_indexes_searches_and_previews(): void
    {
        $pdf = $this->mail->deliver(self::OWNER, ['subject' => 'Your invoice', 'from' => ['name' => 'Ada Bank', 'email' => 'billing@adabank.test'], 'attachments' => [['name' => 'invoice.pdf', 'mime' => 'application/pdf', 'content' => '%PDF-1.4 fake']]]);
        $this->mail->deliver(self::OWNER, ['subject' => 'Photos', 'attachments' => [['name' => 'beach.jpg', 'mime' => 'image/jpeg', 'content' => 'jpg'], ['name' => 'run-me.exe', 'mime' => 'application/octet-stream', 'content' => 'MZ']]]);
        $this->mail->deliver(self::OWNER, ['subject' => 'Spam', 'attachments' => [['name' => 'junk.pdf', 'mime' => 'application/pdf', 'content' => 'x']]], 'Junk');
        $this->mail->deliver(self::OWNER, ['subject' => 'No files']);
        $gm = $this->gm();

        $all = $gm->getJson('/api/v1/greenmail/attachments')->assertOk()->assertJsonPath('total', 3)->assertJsonPath('indexing', false);
        $this->assertSame(1, $all->json('counts.pdf'), 'Junk is skipped');
        $this->assertNotNull(collect($all->json('attachments'))->firstWhere('name', 'run-me.exe')['warning']);

        $gm->getJson('/api/v1/greenmail/attachments?kind=image')->assertJsonPath('total', 1)->assertJsonPath('attachments.0.name', 'beach.jpg');
        $gm->getJson('/api/v1/greenmail/attachments?q=adabank')->assertJsonPath('total', 1)->assertJsonPath('attachments.0.previewable', true);

        // New mail later is picked up; nothing is indexed twice.
        $this->mail->deliver(self::OWNER, ['subject' => 'Sheet', 'attachments' => [['name' => 'q3.xlsx', 'mime' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content' => 'x']]]);
        $gm->getJson('/api/v1/greenmail/attachments')->assertJsonPath('total', 4);
        $this->assertSame(4, GreenmailAttachment::count());

        // Preview inline for safe types only.
        $gm->get("/api/v1/greenmail/messages/{$pdf}/attachments/0?folder=INBOX&inline=1")->assertOk()->assertHeader('Content-Disposition', 'inline; filename="invoice.pdf"');
        $html = $this->mail->deliver(self::OWNER, ['attachments' => [['name' => 'page.html', 'mime' => 'text/html', 'content' => '<script>1</script>']]]);
        $this->assertStringStartsWith('attachment;', $gm->get("/api/v1/greenmail/messages/{$html}/attachments/0?folder=INBOX&inline=1")->headers->get('Content-Disposition'));

        // Another mailbox sees none of it.
        $this->gm('other@example.com', 'other-pass')->getJson('/api/v1/greenmail/attachments')->assertJsonPath('total', 0);
    }

    public function test_a_folder_empty_on_the_first_scan_still_picks_up_new_mail(): void
    {
        $gm = $this->gm();
        $gm->getJson('/api/v1/greenmail/attachments')->assertJsonPath('total', 0);

        $this->mail->deliver(self::OWNER, ['attachments' => [['name' => 'later.pdf', 'mime' => 'application/pdf', 'content' => 'x']]]);
        $gm->getJson('/api/v1/greenmail/attachments')->assertJsonPath('total', 1);
    }

    public function test_share_links_work_until_they_expire_run_out_or_are_revoked(): void
    {
        $uid = $this->mail->deliver(self::OWNER, ['attachments' => [['name' => 'report.pdf', 'mime' => 'application/pdf', 'content' => '%PDF-report'], ['name' => 'tool.exe', 'mime' => 'application/octet-stream', 'content' => 'MZ']]]);
        $gm = $this->gm();

        $gm->postJson('/api/v1/greenmail/attachments/share', ['folder' => 'INBOX', 'uid' => $uid, 'index' => 1])->assertStatus(422);

        $url = $gm->postJson('/api/v1/greenmail/attachments/share', ['folder' => 'INBOX', 'uid' => $uid, 'index' => 0, 'days' => 2, 'max_downloads' => 2])->assertCreated()->json('url');
        $share = GreenmailSharedFile::firstOrFail();
        $this->assertStringEndsWith('/api/v1/greenmail/shared/'.$share->token, $url);
        Storage::disk('local')->assertExists($share->path);
        $this->assertStringNotContainsString('%PDF-report', Storage::disk('local')->get($share->path), 'stored encrypted');

        $path = '/api/v1/greenmail/shared/'.$share->token;
        $this->assertSame('%PDF-report', $this->get($path)->assertOk()->getContent());
        $this->get($path)->assertOk();
        $this->get($path)->assertStatus(410);

        // Revoked.
        $gm->postJson('/api/v1/greenmail/attachments/share', ['folder' => 'INBOX', 'uid' => $uid, 'index' => 0]);
        $second = GreenmailSharedFile::query()->latest('id')->firstOrFail();
        $this->gm('other@example.com', 'other-pass')->deleteJson("/api/v1/greenmail/attachments/shares/{$second->id}")->assertNotFound();
        $gm = $this->gm();
        $gm->deleteJson("/api/v1/greenmail/attachments/shares/{$second->id}")->assertOk();
        $this->get('/api/v1/greenmail/shared/'.$second->token)->assertStatus(410);

        // Expired: cleaned up by the dispatcher.
        $gm->postJson('/api/v1/greenmail/attachments/share', ['folder' => 'INBOX', 'uid' => $uid, 'index' => 0, 'days' => 1]);
        $third = GreenmailSharedFile::query()->latest('id')->firstOrFail();
        $this->travel(2)->days();
        $this->get('/api/v1/greenmail/shared/'.$third->token)->assertStatus(410);
        $this->artisan('greenmail:dispatch')->assertSuccessful();
        Storage::disk('local')->assertMissing($third->path);
        $this->get('/api/v1/greenmail/shared/nope')->assertStatus(410);
    }
}
