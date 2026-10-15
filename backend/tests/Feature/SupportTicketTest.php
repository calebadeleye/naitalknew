<?php

namespace Tests\Feature;

use App\Models\HostingService;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\SupportTicketActivity;
use App\Notifications\SupportTicketReplied;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\TestCase;

class SupportTicketTest extends TestCase
{
    use CreatesHostingFixtures, RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Storage::fake('local');
        $this->admin = User::factory()->create(['role' => 'super_admin', 'account_status' => 'active', 'email_verified_at' => now(), 'password' => Hash::make('password')]);
    }

    private function tokenFor(User $user): string
    {
        $this->app['auth']->forgetGuards();
        $user->forceFill(['password' => Hash::make('password')])->save();

        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk()->json('token');
    }

    private function clientService(): HostingService
    {
        return $this->createProvisionableHostingService();
    }

    public function test_a_client_opens_a_ticket_about_their_website_with_an_attachment_and_staff_are_emailed(): void
    {
        $service = $this->clientService();
        $token = $this->tokenFor($service->client->user);

        $response = $this->withToken($token)->post('/api/v1/client/support-tickets', [
            'subject' => 'My site shows an error',
            'category' => 'website',
            'priority' => 'high',
            'hosting_service_id' => $service->id,
            'message' => 'Since this morning the homepage says 500.',
            'attachments' => [UploadedFile::fake()->image('error.png')],
        ], ['Accept' => 'application/json'])->assertCreated();

        $number = $response->json('ticket.ticket_number');
        $this->assertMatchesRegularExpression('/^TKT-\d{6}-[A-Z0-9]{5}$/', $number);
        $response->assertJsonPath('ticket.status', 'open')
            ->assertJsonPath('ticket.website', $service->primary_domain)
            ->assertJsonPath('messages.0.files.0.name', 'error.png');
        $this->assertArrayNotHasKey('attachments', $response->json('messages.0'), 'storage paths must not leak');

        Notification::assertSentTo($this->admin, SupportTicketActivity::class, fn ($n) => $n->event === 'opened');
        $this->assertDatabaseHas('notification_logs', ['template' => 'support_ticket_staff_opened', 'recipient' => $this->admin->email, 'status' => 'sent']);

        $this->withToken($token)->get("/api/v1/client/support-tickets/{$number}/messages/{$response->json('messages.0.id')}/attachments/0")->assertOk();

        // The admin bell's count.
        $this->withToken($this->tokenFor($this->admin))->getJson('/api/v1/admin/support-tickets/summary')->assertOk()->assertJsonPath('needs_reply', 1);
    }

    public function test_a_staff_email_that_fails_is_logged_and_the_ticket_is_still_opened(): void
    {
        Notification::swap(new class extends \Illuminate\Support\Testing\Fakes\NotificationFake
        {
            public function sendNow($notifiables, $notification, ?array $channels = null)
            {
                throw new \RuntimeException('Resend rejected the message');
            }
        });
        $service = $this->clientService();

        $this->withToken($this->tokenFor($service->client->user))->postJson('/api/v1/client/support-tickets', [
            'subject' => 'Email down', 'category' => 'email', 'message' => 'No mail since yesterday.',
        ])->assertCreated();

        $this->assertDatabaseHas('notification_logs', ['template' => 'support_ticket_staff_opened', 'status' => 'failed', 'failure_reason' => 'Resend rejected the message']);
    }

    public function test_staff_reply_marks_it_answered_and_emails_the_client_who_can_reply_back(): void
    {
        $service = $this->clientService();
        $clientToken = $this->tokenFor($service->client->user);
        $number = $this->withToken($clientToken)->postJson('/api/v1/client/support-tickets', [
            'subject' => 'Billing question', 'category' => 'billing', 'message' => 'Why was I charged twice?',
        ])->assertCreated()->json('ticket.ticket_number');

        $adminToken = $this->tokenFor($this->admin);
        $this->withToken($adminToken)->getJson('/api/v1/admin/support-tickets?status=open')->assertOk()->assertJsonPath('data.0.ticket_number', $number)->assertJsonPath('counts.open', 1);
        $this->withToken($adminToken)->postJson("/api/v1/admin/support-tickets/{$number}/replies", ['message' => 'Sorry — the second charge has been refunded to your wallet.'])
            ->assertOk()
            ->assertJsonPath('ticket.status', 'answered');

        Notification::assertSentTo($service->client->user, SupportTicketReplied::class);
        $this->assertDatabaseHas('notification_logs', ['template' => 'support_ticket_reply', 'status' => 'sent']);

        $clientToken = $this->tokenFor($service->client->user);
        $this->withToken($clientToken)->getJson("/api/v1/client/support-tickets/{$number}")
            ->assertOk()
            ->assertJsonPath('messages.1.author_type', 'staff')
            ->assertJsonPath('messages.1.author_name', fn ($name) => str_starts_with($name, 'NAI TALK Support'));

        $this->withToken($clientToken)->postJson("/api/v1/client/support-tickets/{$number}/replies", ['message' => 'Thanks!'])
            ->assertOk()->assertJsonPath('ticket.status', 'open');
        $this->withToken($clientToken)->postJson("/api/v1/client/support-tickets/{$number}/close")->assertOk()->assertJsonPath('ticket.status', 'closed');
        $this->assertNotNull(SupportTicket::where('ticket_number', $number)->value('closed_at'));
    }

    public function test_a_client_cannot_see_or_reply_to_another_clients_ticket_or_attach_another_clients_website(): void
    {
        $owner = $this->clientService();
        $intruderService = $this->clientService();
        $number = $this->withToken($this->tokenFor($owner->client->user))->postJson('/api/v1/client/support-tickets', [
            'subject' => 'Private', 'category' => 'other', 'message' => 'secret',
        ])->assertCreated()->json('ticket.ticket_number');

        $intruder = $this->tokenFor($intruderService->client->user);
        $this->withToken($intruder)->getJson("/api/v1/client/support-tickets/{$number}")->assertNotFound();
        $this->withToken($intruder)->postJson("/api/v1/client/support-tickets/{$number}/replies", ['message' => 'hi'])->assertNotFound();
        $this->withToken($intruder)->postJson('/api/v1/client/support-tickets', [
            'subject' => 'x', 'category' => 'website', 'message' => 'y', 'hosting_service_id' => $owner->id,
        ])->assertStatus(422)->assertJsonValidationErrors('hosting_service_id');
    }

    public function test_clients_cannot_use_the_admin_inbox(): void
    {
        $service = $this->clientService();
        $this->withToken($this->tokenFor($service->client->user))->getJson('/api/v1/admin/support-tickets')->assertForbidden();
    }
}
