<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\Greenmail\GreenmailPushSubscription;
use App\Models\Greenmail\GreenmailSession;
use App\Models\MailboxRecord;
use App\Notifications\GreenmailCode;
use App\Notifications\GreenmailDeletionRequested;
use App\Notifications\GreenmailResetRequestedForOwner;
use App\Services\Greenmail\FakeMailGateway;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\PushNotifications;
use App\Services\Ispconfig\FakeIspConfigClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Minishlink\WebPush\VAPID;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/** Green Mail: change password, recovery email, forgot password, and phone notifications. */
class GreenmailAccountTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private FakeMailGateway $mail;

    private FakeIspConfigClient $isp;

    private int $mailUserId;

    private string $ownerEmail;

    /** @var array<int, array> */
    private array $pushed = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->mail = new FakeMailGateway;
        $this->mail->addAccount('caleb@calebadeleye.com', 'old-password');
        $this->app->instance(MailGateway::class, $this->mail);

        $this->isp = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);
        $service = $service->fresh();
        $this->ownerEmail = $service->client->user->email;
        $clientId = (int) $service->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first()->clientMapping->ispconfig_client_id;
        $this->mailUserId = $this->isp->mailUserAdd($this->isp->login(), $clientId, ['email' => 'caleb@calebadeleye.com']);
        MailboxRecord::query()->create(['hosting_service_id' => $service->id, 'ispconfig_mailbox_id' => (string) $this->mailUserId, 'email_address' => 'caleb@calebadeleye.com', 'quota_mb' => 500, 'status' => 'active']);

        $keys = VAPID::createVapidKeys();
        config(['greenmail.vapid.public_key' => $keys['publicKey'], 'greenmail.vapid.private_key' => $keys['privateKey']]);

        $pushed = &$this->pushed;
        $this->app->instance(PushNotifications::class, new class($this->mail, $pushed) extends PushNotifications
        {
            public function __construct(MailGateway $mail, private array &$log)
            {
                parent::__construct($mail);
            }

            protected function deliver(array $outgoing): array
            {
                $results = [];
                foreach ($outgoing as $item) {
                    $this->log[] = $item['payload'];
                    $results[$item['subscription']->endpoint] = str_contains($item['subscription']->endpoint, 'gone') ? 'expired' : 'sent';
                }

                return $results;
            }
        });
    }

    private function token(string $password = 'old-password'): string
    {
        return $this->postJson('/api/v1/greenmail/session', ['email' => 'caleb@calebadeleye.com', 'password' => $password])->assertCreated()->json('token');
    }

    private function ispPassword(): ?string
    {
        return $this->isp->mailUserGet('t', $this->mailUserId)['password'] ?? null;
    }

    public function test_changing_the_password_needs_the_current_one_signs_out_other_devices_and_keeps_this_one(): void
    {
        $phone = $this->token();
        $laptop = $this->token();

        $this->withHeader('X-Greenmail-Token', $laptop)->postJson('/api/v1/greenmail/password', ['current_password' => 'wrong', 'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass'])
            ->assertStatus(422)->assertJsonValidationErrors('current_password');
        $this->withHeader('X-Greenmail-Token', $laptop)->postJson('/api/v1/greenmail/password', ['current_password' => 'old-password', 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertStatus(422)->assertJsonValidationErrors('password');

        $this->withHeader('X-Greenmail-Token', $laptop)->postJson('/api/v1/greenmail/password', ['current_password' => 'old-password', 'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass'])
            ->assertOk();

        $this->assertSame('brand-new-pass', $this->ispPassword(), 'set on the mail server');
        $this->assertSame(1, GreenmailSession::count(), 'the other device is signed out');
        $this->assertSame('brand-new-pass', GreenmailSession::first()->password());

        // This device carries on — even while the mail server still answers to the old password for a moment.
        $this->withHeader('X-Greenmail-Token', $laptop)->getJson('/api/v1/greenmail/folders')->assertOk();
        $this->withHeader('X-Greenmail-Token', $phone)->getJson('/api/v1/greenmail/folders')->assertUnauthorized();
    }

    public function test_a_recovery_email_must_be_confirmed_with_a_code(): void
    {
        Notification::fake();
        $token = $this->token();
        $code = null;

        $this->withHeader('X-Greenmail-Token', $token)->putJson('/api/v1/greenmail/recovery-email', ['recovery_email' => 'caleb@calebadeleye.com'])
            ->assertStatus(422)->assertJsonValidationErrors('recovery_email');
        $this->withHeader('X-Greenmail-Token', $token)->putJson('/api/v1/greenmail/recovery-email', ['recovery_email' => 'caleb.personal@gmail.com'])->assertOk();

        Notification::assertSentOnDemand(GreenmailCode::class, function (GreenmailCode $notification, array $channels, AnonymousNotifiable $notifiable) use (&$code) {
            $code = $notification->code;

            return $notifiable->routes['mail'] === 'caleb.personal@gmail.com' && $notification->purpose === 'verify_recovery';
        });

        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/session')->assertJsonPath('recovery_email_verified', false);
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/recovery-email/confirm', ['code' => '000000'])->assertStatus(422)->assertJsonValidationErrors('code');
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/recovery-email/confirm', ['code' => $code])->assertOk();
        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/session')
            ->assertJsonPath('recovery_email', 'caleb.personal@gmail.com')->assertJsonPath('recovery_email_verified', true);
    }

    public function test_forgot_password_sends_a_code_to_the_recovery_email_and_the_code_resets_it(): void
    {
        Notification::fake();
        $token = $this->token();
        $this->withHeader('X-Greenmail-Token', $token)->putJson('/api/v1/greenmail/recovery-email', ['recovery_email' => 'me@gmail.com']);
        $verify = null;
        Notification::assertSentOnDemand(GreenmailCode::class, function (GreenmailCode $n) use (&$verify) {
            $verify = $n->code;

            return true;
        });
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/recovery-email/confirm', ['code' => $verify])->assertOk();

        $message = $this->postJson('/api/v1/greenmail/password/forgot', ['email' => 'Caleb@CalebAdeleye.com'])->assertOk()->json('message');
        $this->assertSame($message, $this->postJson('/api/v1/greenmail/password/forgot', ['email' => 'nobody@nowhere.test'])->json('message'), 'the answer never reveals whether a mailbox exists');

        $reset = null;
        Notification::assertSentOnDemand(GreenmailCode::class, function (GreenmailCode $n, array $c, AnonymousNotifiable $to) use (&$reset) {
            if ($n->purpose === 'reset') {
                $reset = $n->code;
            }

            return $n->purpose === 'reset' && $to->routes['mail'] === 'me@gmail.com';
        });

        $this->postJson('/api/v1/greenmail/password/reset', ['email' => 'caleb@calebadeleye.com', 'code' => '111111', 'password' => 'fresh-password-9', 'password_confirmation' => 'fresh-password-9'])
            ->assertStatus(422)->assertJsonValidationErrors('code');
        $this->postJson('/api/v1/greenmail/password/reset', ['email' => 'caleb@calebadeleye.com', 'code' => $reset, 'password' => 'fresh-password-9', 'password_confirmation' => 'fresh-password-9'])
            ->assertOk();

        $this->assertSame('fresh-password-9', $this->ispPassword());
        $this->assertSame(0, GreenmailSession::count(), 'every old sign-in ends');
        // A code works once.
        $this->postJson('/api/v1/greenmail/password/reset', ['email' => 'caleb@calebadeleye.com', 'code' => $reset, 'password' => 'another-one-9', 'password_confirmation' => 'another-one-9'])->assertStatus(422);
    }

    public function test_without_a_recovery_email_the_website_owner_is_asked_to_help(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/greenmail/password/forgot', ['email' => 'caleb@calebadeleye.com'])->assertOk();

        Notification::assertSentOnDemand(GreenmailResetRequestedForOwner::class, fn ($n, array $c, AnonymousNotifiable $to) => $to->routes['mail'] === $this->ownerEmail && $n->mailbox === 'caleb@calebadeleye.com');
        Notification::assertNotSentTo(new AnonymousNotifiable, GreenmailCode::class);
    }

    public function test_devices_signed_up_for_notifications_get_one_for_new_unread_mail_only(): void
    {
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Old news']);
        $token = $this->token();

        $this->getJson('/api/v1/greenmail/push/key')->assertOk()->assertJsonPath('public_key', config('greenmail.vapid.public_key'));
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push', ['endpoint' => 'http://insecure.test/x', 'keys' => ['p256dh' => 'k', 'auth' => 'a']])->assertStatus(422);
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push', ['endpoint' => 'https://push.example.test/phone', 'keys' => ['p256dh' => 'k', 'auth' => 'a'], 'domain' => 'calebadeleye.com'])->assertCreated();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push', ['endpoint' => 'https://push.example.test/gone', 'keys' => ['p256dh' => 'k', 'auth' => 'a']])->assertCreated();
        $this->withHeader('X-Greenmail-Token', $token)->getJson('/api/v1/greenmail/push?endpoint='.urlencode('https://push.example.test/phone'))->assertJsonPath('this_device', true);

        $this->artisan('greenmail:push-check')->assertSuccessful();
        $this->assertCount(0, $this->pushed, 'mail already there when notifications were turned on is not announced');

        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Lunch on Friday?', 'from' => ['name' => 'Tolu Ade', 'email' => 'tolu@example.com']]);
        $this->artisan('greenmail:push-check')->assertSuccessful();

        $this->assertCount(2, $this->pushed);
        $this->assertSame('Tolu Ade', $this->pushed[0]['title']);
        $this->assertSame('Lunch on Friday?', $this->pushed[0]['body']);
        $this->assertSame('/greenmail?domain=calebadeleye.com&source=push', $this->pushed[0]['url']);
        $this->assertSame(1, GreenmailPushSubscription::count(), 'a subscription the browser dropped is removed');

        $this->artisan('greenmail:push-check');
        $this->assertCount(2, $this->pushed, 'each email is announced once');

        // A test notification on request.
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/test', ['endpoint' => 'https://push.example.test/phone'])->assertOk();
        $this->assertSame('Green Mail notifications are on', end($this->pushed)['title']);
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/test', ['endpoint' => 'https://push.example.test/never'])->assertStatus(422);
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/problem', ['stage' => 'subscribe', 'message' => 'AbortError'])->assertOk();

        // Signing out on the device turns its notifications off.
        $this->withHeader('X-Greenmail-Token', $token)->deleteJson('/api/v1/greenmail/session')->assertOk();
        $this->assertSame(0, GreenmailPushSubscription::count());
    }

    public function test_notifications_stop_when_the_password_was_changed_elsewhere(): void
    {
        $token = $this->token();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push', ['endpoint' => 'https://push.example.test/phone', 'keys' => ['p256dh' => 'k', 'auth' => 'a']])->assertCreated();

        $this->mail->addAccount('caleb@calebadeleye.com', 'changed-by-the-owner');
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Hello']);
        $this->artisan('greenmail:push-check');

        $this->assertCount(0, $this->pushed);
        $this->assertSame(0, GreenmailPushSubscription::count());
    }

    public function test_a_signed_in_person_can_ask_for_their_mailbox_and_data_to_be_deleted(): void
    {
        Notification::fake();
        $token = $this->token();

        $this->postJson('/api/v1/greenmail/account/deletion-request', ['password' => 'old-password'])->assertUnauthorized();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/account/deletion-request', ['password' => 'wrong'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        Notification::assertNothingSent();

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/account/deletion-request', ['password' => 'old-password'])->assertCreated();

        Notification::assertSentOnDemand(GreenmailDeletionRequested::class, fn ($n, $channels, $notifiable) => $n->forSupport && $notifiable->routes['mail'] === config('company.email'));
        Notification::assertSentOnDemand(GreenmailDeletionRequested::class, fn ($n, $channels, $notifiable) => ! $n->forSupport && $notifiable->routes['mail'] === 'caleb@calebadeleye.com');
    }
}
