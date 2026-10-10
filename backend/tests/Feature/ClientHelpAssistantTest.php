<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\HelpAssistantQuestion;
use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientHelpAssistantTest extends TestCase
{
    use RefreshDatabase;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();

        $user = User::factory()->create(['email_verified_at' => now(), 'role' => 'client']);
        $this->client = Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);

        $group = KnowledgeBaseGroup::query()->create(['name' => 'Wallet & Payments', 'slug' => 'wallet-payments', 'sort_order' => 1]);
        KnowledgeBaseArticle::query()->create([
            'group_id' => $group->id,
            'title' => 'How to Fund Your Wallet',
            'slug' => 'how-to-fund-your-wallet',
            'summary' => 'Add money to your wallet balance.',
            'content' => "Go to Wallet from your dashboard and choose 'Fund Wallet'.",
            'status' => 'published',
        ]);
        KnowledgeBaseArticle::query()->create([
            'group_id' => $group->id,
            'title' => 'Unpublished draft about refunds',
            'slug' => 'refund-draft',
            'content' => 'Not ready yet.',
            'status' => 'draft',
        ]);

        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'gemini-test']);
        Sanctum::actingAs($user, [], 'sanctum');
    }

    private function fakeGeminiReply(string $text): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => $text]]]]],
        ])]);
    }

    public function test_it_answers_from_the_knowledge_base_and_links_the_articles_it_used(): void
    {
        $this->fakeGeminiReply("Open Wallet from the menu and click Fund Wallet.\nARTICLES: how-to-fund-your-wallet\nANSWERED: yes");

        $this->postJson('/api/v1/client/help-assistant', ['message' => 'How do I add money to my wallet?'])
            ->assertOk()
            ->assertJsonPath('reply', 'Open Wallet from the menu and click Fund Wallet.')
            ->assertJsonPath('articles.0.slug', 'how-to-fund-your-wallet')
            ->assertJsonPath('articles.0.url', '/knowledge-base/how-to-fund-your-wallet');

        $logged = HelpAssistantQuestion::query()->sole();
        $this->assertSame($this->client->id, $logged->client_id);
        $this->assertTrue($logged->answered_from_knowledge_base);
        $this->assertFalse($logged->used_fallback);
    }

    public function test_only_published_articles_reach_the_model_and_invented_slugs_are_never_linked(): void
    {
        $this->fakeGeminiReply("I don't have a guide for that yet — please message us on WhatsApp.\nARTICLES: refund-draft, made-up-article\nANSWERED: no");

        $this->postJson('/api/v1/client/help-assistant', ['message' => 'How do refunds work?'])
            ->assertOk()
            ->assertJsonCount(0, 'articles');

        Http::assertSent(function (HttpRequest $request) {
            $prompt = $request['system_instruction']['parts'][0]['text'];

            return str_contains($prompt, 'how-to-fund-your-wallet') && ! str_contains($prompt, 'refund-draft');
        });

        // Unanswered questions are what show which articles are missing.
        $this->assertFalse(HelpAssistantQuestion::query()->sole()->answered_from_knowledge_base);
    }

    public function test_it_falls_back_to_a_knowledge_base_search_when_the_model_is_unavailable(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'overloaded']], 503)]);

        $this->postJson('/api/v1/client/help-assistant', ['message' => 'how do I fund my wallet'])
            ->assertOk()
            ->assertJsonPath('articles.0.slug', 'how-to-fund-your-wallet');

        $this->assertTrue(HelpAssistantQuestion::query()->sole()->used_fallback);
    }

    public function test_it_rejects_an_empty_or_oversized_message(): void
    {
        Http::fake();

        $this->postJson('/api/v1/client/help-assistant', ['message' => ''])->assertUnprocessable();
        $this->postJson('/api/v1/client/help-assistant', ['message' => str_repeat('a', 1001)])->assertUnprocessable();

        Http::assertNothingSent();
    }

    public function test_guests_cannot_use_it(): void
    {
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/v1/client/help-assistant', ['message' => 'hello'])->assertUnauthorized();
    }
}
