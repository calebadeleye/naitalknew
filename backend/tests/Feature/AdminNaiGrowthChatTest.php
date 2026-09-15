<?php

namespace Tests\Feature;

use App\Models\NaiGrowthMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminNaiGrowthChatTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): User
    {
        $user = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($user, [], 'sanctum');

        return $user;
    }

    public function test_admin_can_chat_with_naigrowth_and_the_turn_is_persisted(): void
    {
        $admin = $this->actingAsAdmin();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    ['content' => ['parts' => [['text' => 'Current revenue is on track.']]]],
                ],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'How are we doing this month?',
        ])->assertOk();

        $response->assertJsonPath('reply', 'Current revenue is on track.');
        $this->assertArrayHasKey('revenue', $response->json('facts'));

        $this->assertSame(2, NaiGrowthMessage::query()->where('user_id', $admin->id)->count());
        $this->assertSame('user', NaiGrowthMessage::query()->oldest('id')->first()->role);
        $this->assertSame('assistant', NaiGrowthMessage::query()->latest('id')->first()->role);
    }

    public function test_a_gemini_failure_surfaces_a_clear_error_instead_of_a_fake_reply(): void
    {
        $this->actingAsAdmin();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'quota exceeded']], 429),
        ]);

        $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'Find me prospects.',
        ])->assertStatus(502)->assertJsonFragment(['message' => "NaiGrowth couldn't reach Gemini — quota exceeded"]);
    }

    public function test_a_network_level_gemini_failure_also_surfaces_a_clear_error(): void
    {
        // Regression: Http::post() throws Illuminate\Http\Client\ConnectionException
        // (extends \Exception, not \RuntimeException) on a timeout/DNS/connection
        // failure — this must not slip past the controller's catch as a raw 500.
        $this->actingAsAdmin();

        Http::fake(function () {
            throw new ConnectionException('Operation timed out after 30001 milliseconds');
        });

        $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'How are we doing this month?',
        ])->assertStatus(502)->assertJsonFragment([
            'message' => "NaiGrowth couldn't reach Gemini — Operation timed out after 30001 milliseconds",
        ]);
    }

    public function test_a_non_admin_cannot_reach_naigrowth(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        Sanctum::actingAs($user, [], 'sanctum');

        $this->postJson('/api/v1/admin/naigrowth/chat', ['message' => 'hi'])
            ->assertStatus(403);
    }
}
