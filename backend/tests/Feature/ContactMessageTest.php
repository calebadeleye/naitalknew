<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use App\Notifications\NaiTalkContactMessageReceived;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ContactMessageTest extends TestCase
{
    use RefreshDatabase;

    private array $form = ['name' => 'Hannah Melotto', 'email' => 'hannah@example.test', 'service' => 'Business Website', 'details' => "We need a new site.\nThanks", 'page' => 'contact_page'];

    public function test_a_message_is_saved_and_emailed_to_naitalk_with_reply_to_the_sender(): void
    {
        config(['services.turnstile.site_key' => null, 'services.turnstile.secret_key' => null]);
        Notification::fake();

        $this->postJson('/api/v1/public/contact', $this->form)->assertCreated();

        $saved = ContactMessage::query()->sole();
        $this->assertSame('Hannah Melotto', $saved->name);
        $this->assertNotNull($saved->emailed_at);
        Notification::assertSentTo(new AnonymousNotifiable, NaiTalkContactMessageReceived::class, function ($n, $channels, $notifiable) {
            $mail = $n->toMail($notifiable);

            return $notifiable->routes['mail'] === 'info@naitalk.com' && $mail->replyTo[0][0] === 'hannah@example.test';
        });
    }

    public function test_if_email_fails_the_message_is_still_saved(): void
    {
        config(['services.turnstile.site_key' => null, 'services.turnstile.secret_key' => null]);
        Notification::shouldReceive('route')->andThrow(new \RuntimeException('mail down'));

        $this->postJson('/api/v1/public/contact', $this->form)->assertCreated();
        $this->assertNull(ContactMessage::query()->sole()->emailed_at);
    }

    public function test_with_turnstile_on_a_message_needs_a_passing_check(): void
    {
        config(['services.turnstile.site_key' => 'site', 'services.turnstile.secret_key' => 'secret']);
        Notification::fake();
        Http::fake(['challenges.cloudflare.com/*' => Http::sequence()->push(['success' => false])->push(['success' => true])]);

        $this->postJson('/api/v1/public/contact', $this->form)->assertStatus(422)->assertJsonValidationErrors('turnstile_token');
        $this->postJson('/api/v1/public/contact', $this->form + ['turnstile_token' => 'bot'])->assertStatus(422);
        $this->assertSame(0, ContactMessage::query()->count());

        $this->postJson('/api/v1/public/contact', $this->form + ['turnstile_token' => 'human'])->assertCreated();
    }

    public function test_missing_fields_are_refused(): void
    {
        $this->postJson('/api/v1/public/contact', ['name' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['email', 'service', 'details']);
    }
}
