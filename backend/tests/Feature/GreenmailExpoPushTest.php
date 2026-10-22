<?php

namespace Tests\Feature;

use App\Models\Greenmail\GreenmailExpoPushToken;
use App\Services\Greenmail\ExpoPushNotifications;
use App\Services\Greenmail\FakeMailGateway;
use App\Services\Greenmail\MailGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Green Mail phone app: new-mail notifications through Expo's push service. */
class GreenmailExpoPushTest extends TestCase
{
    use RefreshDatabase;

    private FakeMailGateway $mail;

    private const PHONE = 'ExponentPushToken[phone-abc123]';

    private const GONE = 'ExponentPushToken[gone-xyz789]';

    protected function setUp(): void
    {
        parent::setUp();

        $this->mail = new FakeMailGateway;
        $this->mail->addAccount('caleb@calebadeleye.com', 'secret-pass');
        $this->app->instance(MailGateway::class, $this->mail);

        // Expo answers one ticket per message; the "gone" phone uninstalled the app.
        Http::fake([ExpoPushNotifications::ENDPOINT => fn (Request $request) => Http::response(['data' => array_map(
            fn (array $m) => str_contains($m['to'], 'gone') ? ['status' => 'error', 'details' => ['error' => 'DeviceNotRegistered']] : ['status' => 'ok', 'id' => 'ticket'],
            $request->data(),
        )])]);
    }

    private function token(): string
    {
        return $this->postJson('/api/v1/greenmail/session', ['email' => 'caleb@calebadeleye.com', 'password' => 'secret-pass'])->assertCreated()->json('token');
    }

    /** @return array<int, array> every message sent to Expo */
    private function sent(): array
    {
        return Http::recorded()->flatMap(fn ($pair) => $pair[0]->data())->all();
    }

    public function test_phones_get_one_notification_per_new_unread_email(): void
    {
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Old news']);
        $token = $this->token();

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/expo', ['token' => 'not-a-token'])->assertStatus(422);
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/expo', ['token' => self::PHONE, 'platform' => 'android'])->assertCreated();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/expo', ['token' => self::GONE, 'platform' => 'ios'])->assertCreated();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/expo', ['token' => self::PHONE, 'platform' => 'android'])->assertCreated();
        $this->assertSame(2, GreenmailExpoPushToken::count(), 'registering again (app restart) does not add a second row');

        $this->artisan('greenmail:expo-push-check')->assertSuccessful();
        $this->assertCount(0, $this->sent(), 'mail already there when notifications were turned on is not announced');

        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Lunch on Friday?', 'from' => ['name' => 'Tolu Ade', 'email' => 'tolu@example.com']]);
        $this->artisan('greenmail:expo-push-check')->assertSuccessful();

        $sent = $this->sent();
        $this->assertCount(2, $sent);
        $this->assertSame(self::PHONE, $sent[0]['to']);
        $this->assertSame('Tolu Ade', $sent[0]['title']);
        $this->assertSame('Lunch on Friday?', $sent[0]['body']);
        $this->assertSame('caleb@calebadeleye.com', $sent[0]['data']['mailbox']);
        $this->assertSame(1, GreenmailExpoPushToken::count(), 'a phone Expo says is gone is removed');

        $this->artisan('greenmail:expo-push-check');
        $this->assertCount(2, $this->sent(), 'each email is announced once');

        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/expo/test', ['token' => self::PHONE])->assertOk();
        $this->assertSame('Green Mail notifications are on', collect($this->sent())->last()['title']);
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/expo/test', ['token' => 'ExponentPushToken[never]'])->assertStatus(422);

        $this->withHeader('X-Greenmail-Token', $token)->deleteJson('/api/v1/greenmail/push/expo', ['token' => self::PHONE])->assertOk();
        $this->assertSame(0, GreenmailExpoPushToken::count());
    }

    public function test_notifications_stop_when_the_password_was_changed_elsewhere(): void
    {
        $token = $this->token();
        $this->withHeader('X-Greenmail-Token', $token)->postJson('/api/v1/greenmail/push/expo', ['token' => self::PHONE])->assertCreated();

        $this->mail->addAccount('caleb@calebadeleye.com', 'changed-by-the-owner');
        $this->mail->deliver('caleb@calebadeleye.com', ['subject' => 'Hello']);
        $this->artisan('greenmail:expo-push-check');

        $this->assertCount(0, $this->sent());
        $this->assertSame(0, GreenmailExpoPushToken::count());
    }

    public function test_it_needs_a_signed_in_mailbox(): void
    {
        $this->postJson('/api/v1/greenmail/push/expo', ['token' => self::PHONE])->assertUnauthorized();
    }
}
