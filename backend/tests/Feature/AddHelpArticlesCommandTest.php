<?php

namespace Tests\Feature;

use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AddHelpArticlesCommandTest extends TestCase
{
    use RefreshDatabase;

    private function seedOriginalSupportArticle(string $content): KnowledgeBaseArticle
    {
        $group = KnowledgeBaseGroup::query()->create(['name' => 'Support Tickets', 'slug' => 'support-tickets', 'sort_order' => 8]);

        return KnowledgeBaseArticle::query()->create([
            'group_id' => $group->id,
            'title' => 'How to Raise a Support Ticket',
            'slug' => 'how-to-raise-a-support-ticket',
            'content' => $content,
            'status' => 'published',
        ]);
    }

    public function test_it_adds_the_missing_articles_and_corrects_the_support_article(): void
    {
        $support = $this->seedOriginalSupportArticle('You can reach support via WhatsApp, or by opening a support ticket from your dashboard describing the issue.');

        $this->artisan('kb:add-help-articles')->assertSuccessful();

        $this->assertSame(7, KnowledgeBaseArticle::query()->where('slug', '!=', 'how-to-raise-a-support-ticket')->published()->count());
        $this->assertDatabaseHas('knowledge_base_articles', ['slug' => 'how-to-download-your-receipt', 'status' => 'published']);
        $this->assertSame('How to Get Help and Support', $support->fresh()->title);
        $this->assertStringNotContainsString('support ticket from your dashboard', $support->fresh()->content);
    }

    public function test_it_is_safe_to_re_run_and_never_overwrites_admin_edits(): void
    {
        $support = $this->seedOriginalSupportArticle('Our own wording, edited by an admin.');

        $this->artisan('kb:add-help-articles')->assertSuccessful();
        $this->artisan('kb:add-help-articles')->assertSuccessful();

        $this->assertSame(1, KnowledgeBaseArticle::query()->where('slug', 'how-to-renew-a-domain')->count());
        $this->assertSame('Our own wording, edited by an admin.', $support->fresh()->content);
    }

    public function test_a_dry_run_writes_nothing(): void
    {
        $this->seedOriginalSupportArticle('… or by opening a support ticket from your dashboard …');

        $this->artisan('kb:add-help-articles', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame(1, KnowledgeBaseArticle::query()->count());
        $this->assertSame('How to Raise a Support Ticket', KnowledgeBaseArticle::query()->value('title'));
    }
}
