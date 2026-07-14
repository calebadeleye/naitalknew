<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Domain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Every new registrar-related admin route must reject non-admin tokens,
 * consistent with the existing role:super_admin,admin_staff middleware
 * already protecting the rest of the admin domain endpoints.
 */
class CloudflareRegistrarPermissionsTest extends TestCase
{
    use RefreshDatabase;

    private function makeClientToken(): string
    {
        $user = User::factory()->create(['role' => 'client']);
        Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);

        Sanctum::actingAs($user, [], 'sanctum');

        return $user->createToken('test')->plainTextToken;
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $domain = Domain::query()->create([
            'client_id' => null,
            'domain_name' => 'perm-test.com',
            'tld' => '.com',
            'source' => 'cloudflare_imported',
            'provider' => 'cloudflare',
            'status' => 'pending',
            'ownership_assignment_status' => 'needs_review',
        ]);

        $this->getJson('/api/v1/admin/domain-assignments')->assertStatus(401);
        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/assign", [])->assertStatus(401);
        $this->postJson("/api/v1/admin/domains/{$domain->id}/refresh-from-cloudflare")->assertStatus(401);
        $this->getJson("/api/v1/admin/domains/{$domain->id}/sync-logs")->assertStatus(401);
    }

    public function test_client_role_tokens_are_rejected_from_every_registrar_admin_route(): void
    {
        $client = User::factory()->create(['role' => 'client']);
        Client::query()->create([
            'user_id' => $client->id,
            'client_code' => 'CL-'.$client->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $client->email,
        ]);
        Sanctum::actingAs($client, [], 'sanctum');

        $domain = Domain::query()->create([
            'client_id' => null,
            'domain_name' => 'perm-test-2.com',
            'tld' => '.com',
            'source' => 'cloudflare_imported',
            'provider' => 'cloudflare',
            'status' => 'pending',
            'ownership_assignment_status' => 'needs_review',
        ]);

        $this->getJson('/api/v1/admin/domain-assignments')->assertStatus(403);
        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/assign", ['client_id' => 1])->assertStatus(403);
        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/reassign", ['client_id' => 1])->assertStatus(403);
        $this->postJson("/api/v1/admin/domain-assignments/{$domain->id}/mark-internal")->assertStatus(403);
        $this->postJson("/api/v1/admin/domains/{$domain->id}/refresh-from-cloudflare")->assertStatus(403);
        $this->postJson("/api/v1/admin/domains/{$domain->id}/note", ['assignment_note' => 'x'])->assertStatus(403);
        $this->getJson("/api/v1/admin/domains/{$domain->id}/sync-logs")->assertStatus(403);
    }

    public function test_super_admin_can_access_every_registrar_admin_route(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($admin, [], 'sanctum');

        $domain = Domain::query()->create([
            'client_id' => null,
            'domain_name' => 'perm-test-3.com',
            'tld' => '.com',
            'source' => 'cloudflare_imported',
            'provider' => 'cloudflare',
            'status' => 'pending',
            'ownership_assignment_status' => 'needs_review',
        ]);

        $this->getJson('/api/v1/admin/domain-assignments')->assertOk();
        $this->getJson("/api/v1/admin/domains/{$domain->id}/sync-logs")->assertOk();
    }
}
