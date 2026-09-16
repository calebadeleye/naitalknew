<?php

namespace Tests\Feature;

use App\Models\NaiGrowthSocialAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminNaiGrowthSocialAccountTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): User
    {
        $user = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($user, [], 'sanctum');

        return $user;
    }

    public function test_index_lists_all_four_platforms_not_connected_by_default(): void
    {
        $this->actingAsAdmin();

        $response = $this->getJson('/api/v1/admin/naigrowth/social-accounts')->assertOk();

        $platforms = collect($response->json('data'))->pluck('status', 'platform');
        $this->assertSame([
            'facebook' => 'not_connected',
            'instagram' => 'not_connected',
            'linkedin' => 'not_connected',
            'tiktok' => 'not_connected',
        ], $platforms->sortKeys()->all());
    }

    public function test_connecting_an_account_stores_the_token_encrypted_and_never_returns_it(): void
    {
        $admin = $this->actingAsAdmin();
        $account = NaiGrowthSocialAccount::query()->where('platform', 'instagram')->firstOrFail();

        $response = $this->postJson("/api/v1/admin/naigrowth/social-accounts/{$account->id}/connect", [
            'display_name' => 'Naitalk',
            'external_account_id' => '17841400000000000',
            'access_token' => 'super-secret-token',
        ])->assertOk();

        $response->assertJsonPath('data.status', 'connected');
        $response->assertJsonMissingPath('data.access_token_encrypted');
        $this->assertStringNotContainsString('super-secret-token', $response->getContent());

        $account->refresh();
        $this->assertSame('connected', $account->status);
        $this->assertSame($admin->id, $account->connected_by_user_id);
        $this->assertSame('super-secret-token', $account->access_token_encrypted);

        // Ciphertext at rest -- the raw DB column must not equal the plaintext.
        $rawColumn = DB::table('naigrowth_social_accounts')->where('id', $account->id)->value('access_token_encrypted');
        $this->assertNotSame('super-secret-token', $rawColumn);
    }

    public function test_disconnecting_clears_the_token_and_resets_status(): void
    {
        $this->actingAsAdmin();
        $account = NaiGrowthSocialAccount::query()->where('platform', 'facebook')->firstOrFail();
        $account->update([
            'status' => 'connected',
            'access_token_encrypted' => 'some-token',
            'external_account_id' => '123',
        ]);

        $this->postJson("/api/v1/admin/naigrowth/social-accounts/{$account->id}/disconnect")->assertOk()
            ->assertJsonPath('data.status', 'not_connected');

        $account->refresh();
        $this->assertNull($account->access_token_encrypted);
        $this->assertNull($account->external_account_id);
    }

    public function test_a_non_admin_cannot_reach_social_accounts(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        Sanctum::actingAs($user, [], 'sanctum');

        $this->getJson('/api/v1/admin/naigrowth/social-accounts')->assertStatus(403);
    }
}
