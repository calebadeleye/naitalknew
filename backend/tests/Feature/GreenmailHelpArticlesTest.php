<?php

namespace Tests\Feature;

use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GreenmailHelpArticlesTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_adds_the_email_guides_once_and_keeps_later_edits(): void
    {
        $this->artisan('kb:add-greenmail-articles')->assertSuccessful();

        $group = KnowledgeBaseGroup::query()->where('slug', 'email-green-mail')->firstOrFail();
        $this->assertSame('Mail', $group->icon);
        $this->assertSame(6, KnowledgeBaseArticle::query()->where('group_id', $group->id)->where('status', 'published')->count());

        KnowledgeBaseArticle::query()->where('slug', 'how-to-send-an-email-in-green-mail')->update(['title' => 'Edited by an admin']);
        $this->artisan('kb:add-greenmail-articles')->assertSuccessful();

        $this->assertSame(6, KnowledgeBaseArticle::query()->count());
        $this->assertSame('Edited by an admin', KnowledgeBaseArticle::query()->where('slug', 'how-to-send-an-email-in-green-mail')->value('title'));
        $this->getJson('/api/v1/public/knowledge-base/how-to-check-your-emails-in-green-mail')->assertOk();
    }
}
