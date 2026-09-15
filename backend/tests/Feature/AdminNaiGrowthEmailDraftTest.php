<?php

namespace Tests\Feature;

use App\Mail\NaiGrowthDraftMail;
use App\Models\NaiGrowthEmailDraft;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminNaiGrowthEmailDraftTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): User
    {
        $user = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($user, [], 'sanctum');

        return $user;
    }

    private function makeDraft(User $creator, array $overrides = []): NaiGrowthEmailDraft
    {
        return NaiGrowthEmailDraft::query()->create(array_merge([
            'created_by_user_id' => $creator->id,
            'recipient_email' => 'jane@example.com',
            'recipient_name' => 'Jane Doe',
            'subject' => 'Following up',
            'body' => 'Hi Jane...',
            'status' => 'pending_review',
        ], $overrides));
    }

    public function test_approving_a_pending_draft_actually_sends_it(): void
    {
        $admin = $this->actingAsAdmin();
        Mail::fake();
        $draft = $this->makeDraft($admin);

        $this->postJson("/api/v1/admin/naigrowth/email-drafts/{$draft->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent');

        Mail::assertSent(NaiGrowthDraftMail::class, fn ($mail) => $mail->hasTo('jane@example.com'));

        $draft->refresh();
        $this->assertSame('sent', $draft->status);
        $this->assertNotNull($draft->sent_at);
        $this->assertSame($admin->id, $draft->reviewed_by_user_id);
    }

    public function test_discarding_a_pending_draft_never_sends_it(): void
    {
        $admin = $this->actingAsAdmin();
        Mail::fake();
        $draft = $this->makeDraft($admin);

        $this->postJson("/api/v1/admin/naigrowth/email-drafts/{$draft->id}/discard")
            ->assertOk()
            ->assertJsonPath('data.status', 'discarded');

        Mail::assertNothingSent();
        $this->assertSame('discarded', $draft->fresh()->status);
    }

    public function test_an_already_sent_draft_cannot_be_approved_again(): void
    {
        $admin = $this->actingAsAdmin();
        Mail::fake();
        $draft = $this->makeDraft($admin, ['status' => 'sent', 'sent_at' => now()]);

        $this->postJson("/api/v1/admin/naigrowth/email-drafts/{$draft->id}/approve")
            ->assertStatus(422);

        Mail::assertNothingSent();
    }

    public function test_a_mail_transport_failure_leaves_the_draft_pending_and_reports_a_clear_error(): void
    {
        $admin = $this->actingAsAdmin();
        $draft = $this->makeDraft($admin);

        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP connection refused'));

        $this->postJson("/api/v1/admin/naigrowth/email-drafts/{$draft->id}/approve")
            ->assertStatus(502)
            ->assertJsonFragment(['message' => 'Could not send this email — SMTP connection refused']);

        $this->assertSame('pending_review', $draft->fresh()->status);
    }

    public function test_editing_a_pending_draft_updates_subject_and_body(): void
    {
        $admin = $this->actingAsAdmin();
        $draft = $this->makeDraft($admin);

        $this->putJson("/api/v1/admin/naigrowth/email-drafts/{$draft->id}", [
            'subject' => 'Edited subject',
            'body' => 'Edited body',
        ])->assertOk()->assertJsonPath('data.subject', 'Edited subject');

        $this->assertSame('Edited body', $draft->fresh()->body);
    }

    public function test_a_non_admin_cannot_reach_the_approval_queue(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        Sanctum::actingAs($user, [], 'sanctum');

        $this->getJson('/api/v1/admin/naigrowth/email-drafts')->assertStatus(403);
    }
}
