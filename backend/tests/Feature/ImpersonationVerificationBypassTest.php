<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * Uses real tokens (not Sanctum::actingAs) for every assertion in this file
 * deliberately — Sanctum's TransientToken::can() always returns true for any
 * ability regardless of what's passed to actingAs(), so it can't be used to
 * meaningfully prove an ability-based gate like this one actually works.
 */
class ImpersonationVerificationBypassTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    public function test_an_admin_impersonating_an_unverified_client_can_still_view_a_service(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        $service->client->user->forceFill(['email_verified_at' => null])->save();

        $admin = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($admin, [], 'sanctum');

        $impersonationToken = $this->postJson("/api/v1/admin/clients/{$service->client->id}/impersonate")
            ->assertOk()
            ->json('token');

        $this->app['auth']->forgetGuards();

        $this->withToken($impersonationToken)
            ->getJson("/api/v1/client/services/{$service->id}/manage")
            ->assertOk();
    }

    public function test_a_normal_unverified_client_login_is_still_blocked_from_viewing_a_service(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        $service->client->user->forceFill(['email_verified_at' => null, 'password' => 'the-password'])->save();

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $service->client->user->email,
            'password' => 'the-password',
        ])->assertOk()->json('token');

        $this->app['auth']->forgetGuards();

        $this->withToken($token)
            ->getJson("/api/v1/client/services/{$service->id}/manage")
            ->assertStatus(403);
    }
}
