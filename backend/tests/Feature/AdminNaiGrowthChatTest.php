<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\NaiGrowthEmailDraft;
use App\Models\NaiGrowthMessage;
use App\Models\User;
use App\Models\WebsiteQuoteRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
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

    private function makeLead(): WebsiteQuoteRequest
    {
        return WebsiteQuoteRequest::query()->create([
            'reference' => 'WQ-'.uniqid(),
            'name' => 'Jane Doe',
            'phone' => '08000000000',
            'email' => 'jane@example.com',
            'website_type' => 'business',
            'estimated_budget' => '100000-200000',
            'project_description' => 'Needs a corporate site.',
            'status' => 'new',
        ]);
    }

    private function functionCallResponse(string $name, array $args): array
    {
        return [
            'candidates' => [
                ['content' => ['parts' => [['functionCall' => ['name' => $name, 'args' => $args]]]]],
            ],
        ];
    }

    private function textResponse(string $text): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => $text]]]]]];
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

    public function test_naigrowth_can_mark_a_lead_as_contacted(): void
    {
        $this->actingAsAdmin();
        $lead = $this->makeLead();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::sequence()
                ->push($this->functionCallResponse('update_lead_status', ['lead_id' => $lead->id, 'status' => 'contacted']))
                ->push($this->textResponse('Done — marked Jane Doe as contacted.')),
        ]);

        $response = $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'Mark the Jane Doe lead as contacted.',
        ])->assertOk();

        $response->assertJsonPath('reply', 'Done — marked Jane Doe as contacted.');
        $response->assertJsonPath('actions_taken.0.tool', 'update_lead_status');

        $lead->refresh();
        $this->assertSame('contacted', $lead->status);
        $this->assertNotNull($lead->contacted_at);

        $assistantRow = NaiGrowthMessage::query()->where('role', 'assistant')->latest('id')->first();
        $this->assertNotNull($assistantRow->actions_taken);
        $this->assertStringContainsString('Jane Doe', $assistantRow->actions_taken[0]['summary']);
    }

    public function test_naigrowth_can_add_a_client_note(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::sequence()
                ->push($this->functionCallResponse('add_client_note', ['client_id' => $client->id, 'note' => 'Strong upsell candidate.']))
                ->push($this->textResponse('Noted.')),
        ]);

        $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'Add a note that this client is a strong upsell candidate.',
        ])->assertOk()->assertJsonPath('reply', 'Noted.');

        $client->refresh();
        $this->assertStringContainsString('Strong upsell candidate.', $client->internal_notes);
        $this->assertStringContainsString('NaiGrowth', $client->internal_notes);
    }

    public function test_an_invalid_lead_id_is_reported_back_to_the_model_instead_of_crashing(): void
    {
        $this->actingAsAdmin();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::sequence()
                ->push($this->functionCallResponse('update_lead_status', ['lead_id' => 999999, 'status' => 'contacted']))
                ->push($this->textResponse("I couldn't find that lead — could you double check the name?")),
        ]);

        $response = $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'Mark lead 999999 as contacted.',
        ])->assertOk();

        $response->assertJsonPath('reply', "I couldn't find that lead — could you double check the name?");
        $this->assertSame([], $response->json('actions_taken'));
    }

    public function test_a_gemini_that_never_stops_calling_tools_is_capped_and_fails_cleanly(): void
    {
        $this->actingAsAdmin();
        $lead = $this->makeLead();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(
                $this->functionCallResponse('update_lead_status', ['lead_id' => $lead->id, 'status' => 'contacted']),
            ),
        ]);

        $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'Mark the lead as contacted.',
        ])->assertStatus(502)->assertJsonFragment([
            'message' => "NaiGrowth couldn't reach Gemini — NaiGrowth could not finish responding after several tool calls — please try again.",
        ]);
    }

    public function test_naigrowth_can_draft_an_email_but_never_sends_it_itself(): void
    {
        $admin = $this->actingAsAdmin();
        Mail::fake();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::sequence()
                ->push($this->functionCallResponse('draft_email', [
                    'recipient_email' => 'jane@example.com',
                    'recipient_name' => 'Jane Doe',
                    'subject' => 'Following up on your website quote',
                    'body' => 'Hi Jane, following up on your request...',
                ]))
                ->push($this->textResponse('Drafted it — check the Approval Queue.')),
        ]);

        $response = $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'Draft a follow-up email to Jane Doe.',
        ])->assertOk();

        $response->assertJsonPath('actions_taken.0.tool', 'draft_email');
        Mail::assertNothingSent();

        $draft = NaiGrowthEmailDraft::query()->sole();
        $this->assertSame('pending_review', $draft->status);
        $this->assertSame('jane@example.com', $draft->recipient_email);
        $this->assertSame($admin->id, $draft->created_by_user_id);

        $assistantRow = NaiGrowthMessage::query()->where('role', 'assistant')->latest('id')->first();
        $this->assertSame($assistantRow->id, $draft->naigrowth_message_id);
    }

    public function test_a_reply_grounded_by_google_search_returns_its_sources(): void
    {
        $this->actingAsAdmin();

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => 'Competitor hosting in Nigeria runs ₦15k-₦30k/yr.']]],
                    'groundingMetadata' => [
                        'groundingChunks' => [
                            ['web' => ['title' => 'Example Hosting Prices', 'uri' => 'https://example.com/pricing']],
                        ],
                    ],
                ]],
            ], 200),
        ]);

        $response = $this->postJson('/api/v1/admin/naigrowth/chat', [
            'message' => 'What are competitors charging for hosting in Nigeria?',
        ])->assertOk();

        $response->assertJsonPath('sources.0.uri', 'https://example.com/pricing');
    }
}
