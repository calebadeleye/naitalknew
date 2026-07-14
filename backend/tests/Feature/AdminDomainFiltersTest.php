<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Domain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminDomainFiltersTest extends TestCase
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

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'super_admin']), [], 'sanctum');
    }

    public function test_provider_filter_narrows_results(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();

        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'cf-one.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active']);
        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'ss-one.com', 'tld' => '.com', 'source' => 'spaceship_registered', 'provider' => 'spaceship', 'status' => 'active']);

        $response = $this->getJson('/api/v1/admin/domains?provider=cloudflare')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('cf-one.com'));
        $this->assertFalse($names->contains('ss-one.com'));
    }

    public function test_ownership_assignment_status_filter_narrows_results(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();

        Domain::query()->create(['client_id' => null, 'domain_name' => 'needs-review.com', 'tld' => '.com', 'source' => 'cloudflare_imported', 'provider' => 'cloudflare', 'status' => 'pending', 'ownership_assignment_status' => 'needs_review']);
        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'assigned.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active', 'ownership_assignment_status' => 'assigned']);

        $response = $this->getJson('/api/v1/admin/domains?ownership_assignment_status=needs_review')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('needs-review.com'));
        $this->assertFalse($names->contains('assigned.com'));
    }

    public function test_payment_status_filter_narrows_results(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();

        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'unpaid.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active', 'payment_status' => 'unpaid']);
        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'paid.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active', 'payment_status' => 'paid']);

        $response = $this->getJson('/api/v1/admin/domains?payment_status=paid')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('paid.com'));
        $this->assertFalse($names->contains('unpaid.com'));
    }

    public function test_registrar_operation_status_filter_narrows_results(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();

        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'reg-pending.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active', 'registrar_operation_status' => 'pending']);
        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'reg-completed.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active', 'registrar_operation_status' => 'completed']);

        $response = $this->getJson('/api/v1/admin/domains?registrar_operation_status=pending')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('reg-pending.com'));
        $this->assertFalse($names->contains('reg-completed.com'));
    }

    public function test_auto_renew_filter_narrows_results(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();

        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'auto-on.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active', 'auto_renew' => true]);
        Domain::query()->create(['client_id' => $client->id, 'domain_name' => 'auto-off.com', 'tld' => '.com', 'source' => 'manual', 'provider' => 'cloudflare', 'status' => 'active', 'auto_renew' => false]);

        $response = $this->getJson('/api/v1/admin/domains?auto_renew=0')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('auto-off.com'));
        $this->assertFalse($names->contains('auto-on.com'));
    }
}
