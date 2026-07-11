<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\NaiTalkVerificationCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    private function registerAndCaptureCode(string $email): array
    {
        Notification::fake();

        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Verify Me',
            'email' => $email,
            'password' => 'secret-password',
        ])->assertCreated()->json('token');

        $user = User::query()->where('email', $email)->firstOrFail();
        $code = null;

        Notification::assertSentTo($user, NaiTalkVerificationCode::class, function (NaiTalkVerificationCode $notification) use (&$code) {
            $code = $notification->code;

            return true;
        });

        return [$token, $code];
    }

    public function test_registration_queues_verification_code_and_never_returns_password(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'New Client',
            'email' => 'new-client@example.test',
            'password' => 'secret-password',
            'phone' => '08000000011',
        ])->assertCreated();

        $response->assertJsonMissingPath('user.password');
        $this->assertDatabaseHas('users', ['email' => 'new-client@example.test', 'account_status' => 'pending_verification']);

        $user = User::query()->where('email', 'new-client@example.test')->firstOrFail();
        $this->assertFalse($user->hasVerifiedEmail());
        $this->assertNotNull($user->verification_code);

        Notification::assertSentTo($user, NaiTalkVerificationCode::class);
    }

    public function test_invalid_login_never_echoes_password_and_is_rejected(): void
    {
        $this->seed();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@naitalk.test',
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonMissingPath('password');
        $response->assertJsonValidationErrors('email');
    }

    public function test_logout_invalidates_the_token(): void
    {
        $this->seed();

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@naitalk.test',
            'password' => 'password',
        ])->assertOk()->json('token');

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        // Laravel's auth guards cache the resolved user for the lifetime of the
        // test's container instance; force a fresh resolution to prove the
        // deleted token can no longer authenticate.
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_successful_login_records_last_login_details_and_an_activity_log_entry(): void
    {
        $this->seed();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'john@naitalk.test',
            'password' => 'password',
        ])->assertOk();

        $user = User::query()->where('email', 'john@naitalk.test')->firstOrFail();

        $this->assertNotNull($user->last_login_at);
        $this->assertNotNull($user->last_login_ip);
        $this->assertNotNull($user->last_login_user_agent);
        $this->assertDatabaseHas('client_activity_logs', [
            'client_id' => $user->client->id,
            'type' => 'login',
        ]);
    }

    public function test_correct_code_marks_user_verified(): void
    {
        [$token, $code] = $this->registerAndCaptureCode('verify-me@example.test');

        $this->withToken($token)->postJson('/api/v1/auth/email/verify-code', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('message', 'Your email has been verified successfully. Your NAI TALK account is now active.');

        $user = User::query()->where('email', 'verify-me@example.test')->firstOrFail();
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertSame('active', $user->account_status);
        $this->assertNull($user->verification_code);
    }

    public function test_wrong_code_does_not_verify(): void
    {
        [$token] = $this->registerAndCaptureCode('wrong-code@example.test');

        $this->withToken($token)->postJson('/api/v1/auth/email/verify-code', ['code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');

        $user = User::query()->where('email', 'wrong-code@example.test')->firstOrFail();
        $this->assertFalse($user->hasVerifiedEmail());
    }

    public function test_expired_code_does_not_verify(): void
    {
        [$token, $code] = $this->registerAndCaptureCode('expired-code@example.test');

        $user = User::query()->where('email', 'expired-code@example.test')->firstOrFail();
        $user->forceFill(['verification_code_expires_at' => now()->subMinute()])->save();

        $this->withToken($token)->postJson('/api/v1/auth/email/verify-code', ['code' => $code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_resend_verification_issues_a_new_code_until_already_verified(): void
    {
        [$token] = $this->registerAndCaptureCode('resend-me@example.test');

        $this->withToken($token)->postJson('/api/v1/auth/email/resend')
            ->assertOk()
            ->assertJsonPath('message', 'Verification code sent. Please check your inbox.');

        $user = User::query()->where('email', 'resend-me@example.test')->firstOrFail();
        Notification::assertSentToTimes($user, NaiTalkVerificationCode::class, 2); // once at registration, once on resend

        $user->forceFill(['email_verified_at' => now()])->save();

        // Force a fresh auth resolution so the controller sees the just-verified state
        // rather than the guard's cached user from the previous request.
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/v1/auth/email/resend')
            ->assertOk()
            ->assertJsonPath('message', 'Your email is already verified.');

        Notification::assertSentToTimes($user, NaiTalkVerificationCode::class, 2); // unchanged, no new send once verified
    }

    public function test_resend_verification_is_rate_limited(): void
    {
        [$token] = $this->registerAndCaptureCode('rate-limited@example.test');

        for ($i = 0; $i < 3; $i++) {
            $this->withToken($token)->postJson('/api/v1/auth/email/resend')->assertOk();
        }

        $this->withToken($token)->postJson('/api/v1/auth/email/resend')->assertStatus(429);
    }

    public function test_verify_code_attempts_are_rate_limited(): void
    {
        [$token] = $this->registerAndCaptureCode('code-attempts@example.test');

        for ($i = 0; $i < 5; $i++) {
            $this->withToken($token)->postJson('/api/v1/auth/email/verify-code', ['code' => '000000'])->assertUnprocessable();
        }

        $this->withToken($token)->postJson('/api/v1/auth/email/verify-code', ['code' => '000000'])->assertStatus(429);
    }

    public function test_login_is_rate_limited_after_repeated_failures(): void
    {
        $this->seed();

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'john@naitalk.test',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', [
            'email' => 'john@naitalk.test',
            'password' => 'wrong-password',
        ])->assertStatus(429);
    }
}
