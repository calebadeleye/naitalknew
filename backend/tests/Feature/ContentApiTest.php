<?php

namespace Tests\Feature;

use App\Models\BlogPost;
use App\Models\Faq;
use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use App\Models\ServiceStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\TestCase;

class ContentApiTest extends TestCase
{
    use CreatesDomainFixtures, RefreshDatabase;

    public function test_public_blog_index_only_returns_published_posts(): void
    {
        BlogPost::query()->create([
            'title' => 'Published Post', 'slug' => 'published-post', 'excerpt' => 'e', 'content' => 'c',
            'status' => 'published', 'published_at' => now()->subDay(),
        ]);
        BlogPost::query()->create([
            'title' => 'Draft Post', 'slug' => 'draft-post', 'excerpt' => 'e', 'content' => 'c',
            'status' => 'draft',
        ]);

        $response = $this->getJson('/api/v1/public/blog')->assertOk();
        $titles = collect($response->json('data'))->pluck('title');

        $this->assertTrue($titles->contains('Published Post'));
        $this->assertFalse($titles->contains('Draft Post'));
    }

    public function test_public_blog_search_filters_by_title(): void
    {
        BlogPost::query()->create([
            'title' => 'Domain Name Tips', 'slug' => 'domain-name-tips', 'excerpt' => 'e', 'content' => 'c',
            'status' => 'published', 'published_at' => now()->subDay(),
        ]);
        BlogPost::query()->create([
            'title' => 'Hosting Guide', 'slug' => 'hosting-guide', 'excerpt' => 'e', 'content' => 'c',
            'status' => 'published', 'published_at' => now()->subDay(),
        ]);

        $response = $this->getJson('/api/v1/public/blog?search=domain')->assertOk();
        $titles = collect($response->json('data'))->pluck('title');

        $this->assertTrue($titles->contains('Domain Name Tips'));
        $this->assertFalse($titles->contains('Hosting Guide'));
    }

    public function test_blog_detail_page_exposes_seo_fields_and_related_posts(): void
    {
        BlogPost::query()->create([
            'title' => 'Main Post', 'slug' => 'main-post', 'excerpt' => 'e', 'content' => str_repeat('word ', 250),
            'status' => 'published', 'published_at' => now()->subDay(),
            'seo_title' => 'Custom SEO Title', 'seo_description' => 'Custom SEO description',
        ]);
        BlogPost::query()->create([
            'title' => 'Related Post', 'slug' => 'related-post', 'excerpt' => 'e', 'content' => 'c',
            'status' => 'published', 'published_at' => now()->subDay(),
        ]);

        $response = $this->getJson('/api/v1/public/blog/main-post')->assertOk();

        $this->assertSame('Custom SEO Title', $response->json('data.seo_title'));
        $this->assertSame('Custom SEO description', $response->json('data.seo_description'));
        $this->assertGreaterThanOrEqual(1, $response->json('data.reading_time_minutes'));
        $this->assertTrue(collect($response->json('related'))->pluck('title')->contains('Related Post'));
    }

    public function test_a_draft_blog_post_is_not_reachable_by_slug(): void
    {
        BlogPost::query()->create([
            'title' => 'Draft', 'slug' => 'draft', 'excerpt' => 'e', 'content' => 'c', 'status' => 'draft',
        ]);

        $this->getJson('/api/v1/public/blog/draft')->assertNotFound();
    }

    public function test_knowledge_base_index_groups_articles_and_hides_drafts(): void
    {
        $group = KnowledgeBaseGroup::query()->create(['name' => 'Wallet & Payments', 'slug' => 'wallet-payments', 'sort_order' => 1]);
        KnowledgeBaseArticle::query()->create([
            'group_id' => $group->id, 'title' => 'How to fund your wallet', 'slug' => 'how-to-fund-your-wallet',
            'summary' => 's', 'content' => 'c', 'status' => 'published',
        ]);
        KnowledgeBaseArticle::query()->create([
            'group_id' => $group->id, 'title' => 'Draft article', 'slug' => 'draft-article',
            'summary' => 's', 'content' => 'c', 'status' => 'draft',
        ]);

        $response = $this->getJson('/api/v1/public/knowledge-base')->assertOk();
        $articleTitles = collect($response->json('groups.0.articles'))->pluck('title');

        $this->assertTrue($articleTitles->contains('How to fund your wallet'));
        $this->assertFalse($articleTitles->contains('Draft article'));
    }

    public function test_knowledge_base_article_page_shows_related_articles_in_the_same_group(): void
    {
        $group = KnowledgeBaseGroup::query()->create(['name' => 'Domains & DNS', 'slug' => 'domains-dns', 'sort_order' => 1]);
        $article = KnowledgeBaseArticle::query()->create([
            'group_id' => $group->id, 'title' => 'How to search and register a domain', 'slug' => 'how-to-search-and-register-a-domain',
            'summary' => 's', 'content' => 'c', 'status' => 'published',
        ]);
        KnowledgeBaseArticle::query()->create([
            'group_id' => $group->id, 'title' => 'How to transfer a domain', 'slug' => 'how-to-transfer-a-domain',
            'summary' => 's', 'content' => 'c', 'status' => 'published',
        ]);

        $response = $this->getJson("/api/v1/public/knowledge-base/{$article->slug}")->assertOk();

        $this->assertSame('Domains & DNS', $response->json('data.group.name'));
        $this->assertTrue(collect($response->json('related'))->pluck('title')->contains('How to transfer a domain'));
    }

    public function test_public_faqs_are_grouped_and_exclude_drafts(): void
    {
        Faq::query()->create(['group' => 'Domains', 'question' => 'Can I buy only a domain?', 'answer' => 'Yes.', 'status' => 'published']);
        Faq::query()->create(['group' => 'Domains', 'question' => 'Draft question', 'answer' => 'Hidden.', 'status' => 'draft']);

        $response = $this->getJson('/api/v1/public/faqs')->assertOk();
        $group = collect($response->json('groups'))->firstWhere('group', 'Domains');
        $questions = collect($group['items'])->pluck('question');

        $this->assertTrue($questions->contains('Can I buy only a domain?'));
        $this->assertFalse($questions->contains('Draft question'));
    }

    public function test_service_status_reports_incident_as_the_overall_status_when_any_service_has_one(): void
    {
        ServiceStatus::query()->create(['service_name' => 'Website Services', 'status' => 'operational', 'sort_order' => 1]);
        ServiceStatus::query()->create(['service_name' => 'Domain Registration', 'status' => 'incident', 'message' => 'Registry lookup delayed.', 'sort_order' => 2]);

        $response = $this->getJson('/api/v1/public/service-status')->assertOk();

        $this->assertSame('incident', $response->json('overall_status'));
    }

    public function test_domain_pricing_table_shows_customer_prices_and_best_for_never_raw_provider_cost(): void
    {
        $this->activateDomainPricing('.com', ['markup_value_kobo' => 800_000]);

        $response = $this->getJson('/api/v1/public/domains/pricing-table')->assertOk();
        $row = collect($response->json('data'))->firstWhere('tld', '.com');

        $this->assertTrue($response->json('available'));
        $this->assertSame('Global businesses', $row['best_for']);
        $this->assertSame(1_500_000 + 800_000, $row['registration_price_kobo']);
        $this->assertArrayNotHasKey('provider_registration_price_minor', $row);
    }

    public function test_domain_pricing_table_reports_unavailable_when_nothing_is_priced(): void
    {
        $response = $this->getJson('/api/v1/public/domains/pricing-table')->assertOk();

        $this->assertFalse($response->json('available'));
        $this->assertSame([], $response->json('data'));
    }

    public function test_admin_can_create_and_update_a_blog_post(): void
    {
        $this->seed();
        $token = $this->domainAdminToken();

        $created = $this->withToken($token)->postJson('/api/v1/admin/blog-posts', [
            'title' => 'How to Choose a Domain Name',
            'content' => 'Full article content here.',
            'excerpt' => 'A short excerpt.',
            'status' => 'published',
            'published_at' => now()->toDateString(),
        ])->assertCreated();

        $this->assertSame('how-to-choose-a-domain-name', $created->json('slug'));

        $this->withToken($token)->putJson("/api/v1/admin/blog-posts/{$created->json('id')}", [
            'title' => 'How to Choose a Domain Name',
            'content' => 'Updated content.',
            'status' => 'draft',
        ])->assertOk()->assertJsonPath('status', 'draft');
    }

    public function test_admin_can_manage_faqs(): void
    {
        $this->seed();
        $token = $this->domainAdminToken();

        $created = $this->withToken($token)->postJson('/api/v1/admin/faqs', [
            'group' => 'Hosting', 'question' => 'What happens if my hosting expires?', 'answer' => 'You get renewal reminders first.', 'status' => 'published',
        ])->assertCreated();

        $this->withToken($token)->deleteJson("/api/v1/admin/faqs/{$created->json('id')}")->assertOk();
    }

    public function test_admin_can_update_service_status(): void
    {
        $this->seed();
        $token = $this->domainAdminToken();
        $status = ServiceStatus::query()->updateOrCreate(
            ['service_name' => 'Support Availability Test'],
            ['status' => 'operational', 'sort_order' => 1]
        );

        $this->withToken($token)->putJson("/api/v1/admin/service-statuses/{$status->id}", [
            'status' => 'maintenance', 'message' => 'Scheduled upgrade tonight.',
        ])->assertOk()->assertJsonPath('status', 'maintenance');
    }

    public function test_non_admin_cannot_manage_blog_posts(): void
    {
        ['token' => $token] = $this->registerVerifiedDomainClient('blog-guard@naitalk.test');

        $this->withToken($token)->postJson('/api/v1/admin/blog-posts', [
            'title' => 'Should not work', 'content' => 'x', 'status' => 'published',
        ])->assertForbidden();
    }
}
