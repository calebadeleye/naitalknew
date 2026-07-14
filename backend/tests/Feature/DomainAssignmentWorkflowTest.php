<?php

namespace Tests\Feature;

use App\Jobs\SyncCloudflareDomainJob;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\Domain;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DomainAssignmentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function makeClient(): Client
    {
        $user = User::factory()->create();

        return Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);
    }

    private function makeUnassignedDomain(): Domain
    {
        return Domain::query()->create([
            'client_id' => null,
            'domain_name' => 'unassigned-import.com',
            'tld' => '.com',
            'source' => 'cloudflare_imported',
            'registration_source' => 'imported',
            'provider' => 'cloudflare',
            'status' => 'pending',
            'ownership_assignment_status' => 'needs_review',
        ]);
    }

    private function actingAsAdmin(): User
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($admin, [], 'sanctum');

        return $admin;
    }

    public function test_admin_can_assign_an_unassigned_domain_to_a_client(): void
    {
        $admin = $this->actingAsAdmin();
        $client = $this->makeClient();
        $domain = $this->makeUnassignedDomain();

        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/assign", [
            'client_id' => $client->id,
            'customer_renewal_price_kobo' => 750000,
            'next_invoice_date' => now()->addDays(30)->toDateString(),
            'assignment_note' => 'Assigned during onboarding call.',
        ])->assertOk();

        $domain->refresh();
        $this->assertSame($client->id, $domain->client_id);
        $this->assertSame('assigned', $domain->ownership_assignment_status);
        $this->assertSame($admin->id, $domain->assigned_by);
        $this->assertNotNull($domain->assigned_at);
        $this->assertSame(750000, $domain->customer_renewal_price_kobo);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain_ownership_assigned',
            'client_id' => $client->id,
            'staff_user_id' => $admin->id,
        ]);
    }

    public function test_assigning_an_already_assigned_domain_is_rejected(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();
        $domain = $this->makeUnassignedDomain();
        $domain->forceFill(['client_id' => $client->id, 'ownership_assignment_status' => 'assigned'])->save();

        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/assign", [
            'client_id' => $client->id,
        ])->assertStatus(422);
    }

    public function test_admin_can_reassign_an_already_assigned_domain_to_a_different_client(): void
    {
        $admin = $this->actingAsAdmin();
        $originalClient = $this->makeClient();
        $newClient = $this->makeClient();
        $domain = $this->makeUnassignedDomain();
        $domain->forceFill(['client_id' => $originalClient->id, 'ownership_assignment_status' => 'assigned'])->save();

        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/reassign", [
            'client_id' => $newClient->id,
            'assignment_note' => 'Ownership transferred.',
        ])->assertOk();

        $domain->refresh();
        $this->assertSame($newClient->id, $domain->client_id);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain_ownership_reassigned',
            'client_id' => $newClient->id,
            'staff_user_id' => $admin->id,
        ]);

        $log = AuditLog::where('action', 'domain_ownership_reassigned')->firstOrFail();
        $this->assertSame($originalClient->id, $log->before_state['client_id']);
    }

    public function test_admin_can_mark_a_domain_as_internal(): void
    {
        $admin = $this->actingAsAdmin();
        $domain = $this->makeUnassignedDomain();

        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/mark-internal", [
            'assignment_note' => 'Company-owned brand domain.',
        ])->assertOk();

        $domain->refresh();
        $this->assertNull($domain->client_id);
        $this->assertSame('internal', $domain->ownership_assignment_status);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'domain_marked_internal',
            'staff_user_id' => $admin->id,
        ]);
    }

    public function test_assignment_never_creates_an_invoice_and_sends_exactly_one_client_notification(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();
        $domain = $this->makeUnassignedDomain();

        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/assign", [
            'client_id' => $client->id,
        ])->assertOk();

        $this->assertDatabaseMissing('invoices', ['client_id' => $client->id]);
        $this->assertSame(1, NotificationLog::where('domain', $domain->domain_name)->count());
    }

    public function test_non_admin_cannot_access_any_domain_assignment_route(): void
    {
        $client = $this->makeClient();
        Sanctum::actingAs($client->user, [], 'sanctum');
        $domain = $this->makeUnassignedDomain();

        $this->getJson('/api/v1/admin/domain-assignments')->assertStatus(403);
        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/assign", ['client_id' => $client->id])->assertStatus(403);
        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/mark-internal")->assertStatus(403);
    }

    public function test_refresh_from_cloudflare_queues_the_sync_job_for_a_cloudflare_domain(): void
    {
        $this->actingAsAdmin();
        Queue::fake();
        $domain = $this->makeUnassignedDomain();

        $this->postJson("/api/v1/admin/domains/{$domain->id}/refresh-from-cloudflare")->assertOk();

        Queue::assertPushed(SyncCloudflareDomainJob::class, fn ($job) => $job->domain->is($domain));
    }

    public function test_refresh_from_cloudflare_is_rejected_for_a_non_cloudflare_domain(): void
    {
        $this->actingAsAdmin();
        Queue::fake();
        $client = $this->makeClient();
        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'spaceship-domain.com',
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
        ]);

        $this->postJson("/api/v1/admin/domains/{$domain->id}/refresh-from-cloudflare")->assertStatus(422);

        Queue::assertNotPushed(SyncCloudflareDomainJob::class);
    }

    public function test_index_lists_only_unassigned_and_needs_review_domains(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();
        $this->makeUnassignedDomain();
        Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'already-assigned.com',
            'tld' => '.com',
            'source' => 'manual',
            'provider' => 'cloudflare',
            'status' => 'active',
            'ownership_assignment_status' => 'assigned',
        ]);

        $response = $this->getJson('/api/v1/admin/domain-assignments')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('unassigned-import.com'));
        $this->assertFalse($names->contains('already-assigned.com'));
    }
}
