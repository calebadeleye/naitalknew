<?php

namespace Tests\Feature;

use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminClientImpersonationTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $this->seed();

        return $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    public function test_admin_can_impersonate_a_client_and_reach_the_client_dashboard(): void
    {
        $token = $this->adminToken();
        $client = Client::query()->where('client_code', 'CLT-202607-JOHN')->firstOrFail();

        $response = $this->withToken($token)->postJson("/api/v1/admin/clients/{$client->id}/impersonate")
            ->assertOk()
            ->assertJsonStructure(['token', 'client', 'user' => ['id', 'name', 'email']]);

        $impersonationToken = $response->json('token');
        $this->assertNotEmpty($impersonationToken);

        // The sanctum guard caches the first resolved user (admin) for the
        // lifetime of the test's container instance; force a fresh
        // resolution now that we're switching to the impersonation token.
        $this->app['auth']->forgetGuards();

        $this->withToken($impersonationToken)->getJson('/api/v1/client/dashboard')->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'impersonate_client',
            'client_id' => $client->id,
        ]);
    }

    public function test_a_client_cannot_impersonate_another_client(): void
    {
        $this->seed();
        $client = Client::query()->where('client_code', 'CLT-202607-JOHN')->firstOrFail();

        $clientToken = $this->postJson('/api/v1/auth/login', [
            'email' => $client->user->email,
            'password' => 'password',
        ])->assertOk()->json('token');

        $this->withToken($clientToken)->postJson("/api/v1/admin/clients/{$client->id}/impersonate")
            ->assertForbidden();
    }
}
