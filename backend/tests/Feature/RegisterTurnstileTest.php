<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RegisterTurnstileTest extends TestCase
{
    use RefreshDatabase;

    private function signUp(array $extra = [])
    {
        return $this->postJson('/api/v1/auth/register', $extra + [
            'terms_accepted' => true, 'name' => 'New Client', 'email' => 'new-client@example.test', 'password' => 'secret-password',
        ]);
    }

    private function turnOn(): void
    {
        config(['services.turnstile.site_key' => '1x00000000000000000000AA', 'services.turnstile.secret_key' => 'secret-test']);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    public function test_without_keys_sign_up_works_as_before_and_no_site_key_is_published(): void
    {
        config(['services.turnstile.site_key' => null, 'services.turnstile.secret_key' => null]);
        $this->getJson('/api/v1/auth/turnstile')->assertExactJson(['site_key' => null]);
        $this->signUp()->assertCreated();
    }

    public function test_with_keys_the_site_key_is_published_and_a_token_is_required(): void
    {
        $this->turnOn();
        Http::fake();
        $this->getJson('/api/v1/auth/turnstile')->assertExactJson(['site_key' => '1x00000000000000000000AA']);
        $this->signUp()->assertStatus(422)->assertJsonValidationErrors('turnstile_token');
        Http::assertNothingSent();
    }

    public function test_a_passing_token_creates_the_account(): void
    {
        $this->turnOn();
        Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);
        $this->signUp(['turnstile_token' => 'good-token'])->assertCreated();
        Http::assertSent(fn ($r) => $r['secret'] === 'secret-test' && $r['response'] === 'good-token');
    }

    public function test_a_failing_token_is_refused(): void
    {
        $this->turnOn();
        Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => false, 'error-codes' => ['invalid-input-response']])]);
        $this->signUp(['turnstile_token' => 'bot-token'])->assertStatus(422)->assertJsonValidationErrors('turnstile_token');
        $this->assertDatabaseMissing('users', ['email' => 'new-client@example.test']);
    }

    public function test_if_cloudflare_is_down_people_can_still_sign_up(): void
    {
        $this->turnOn();
        Http::fake(['challenges.cloudflare.com/*' => Http::response('', 503)]);
        $this->signUp(['turnstile_token' => 'any-token'])->assertCreated();
    }
}
