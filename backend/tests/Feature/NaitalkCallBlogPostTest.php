<?php

namespace Tests\Feature;

use App\Models\BlogPost;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The Naitalk Call launch article: published once, with the SEO fields filled in, and the prices it quotes are the real ones. */
class NaitalkCallBlogPostTest extends TestCase
{
    use RefreshDatabase;

    private const SLUG = 'introducing-naitalk-call-voice-calls-for-developers';

    public function test_the_command_publishes_the_article_with_its_seo_fields_and_can_be_run_again(): void
    {
        $this->artisan('blog:seed-naitalk-call-launch')->assertSuccessful();

        $post = BlogPost::query()->where('slug', self::SLUG)->firstOrFail();
        $this->assertSame('published', $post->status);
        $this->assertLessThanOrEqual(60, mb_strlen($post->seo_title));
        $this->assertLessThanOrEqual(160, mb_strlen($post->seo_description));
        $this->assertStringContainsString('Naitalk Call', $post->seo_title);
        $this->assertNotEmpty($post->featured_image_meta['alt_text']);
        $this->assertStringStartsWith('https://', $post->og_image);
        $this->assertLessThanOrEqual(500, mb_strlen($post->excerpt));
        $this->assertGreaterThanOrEqual(1, substr_count($post->content, "\n## "));

        $publishedAt = $post->published_at;
        $this->artisan('blog:seed-naitalk-call-launch')->assertSuccessful();
        $this->assertSame(1, BlogPost::query()->where('slug', self::SLUG)->count());
        $this->assertTrue($publishedAt->equalTo(BlogPost::query()->where('slug', self::SLUG)->first()->published_at), 'running it again keeps the publish date');

        $this->getJson('/api/v1/public/blog/'.self::SLUG)->assertOk()->assertJsonPath('data.slug', self::SLUG);
    }

    public function test_the_article_quotes_the_prices_and_allowances_of_the_real_plans(): void
    {
        $content = file_get_contents(resource_path('blog-posts/'.self::SLUG.'.md'));

        foreach (config('naitalk_call.plans') as $plan) {
            $dollars = $plan['monthly_usd_cents'] === 0 ? '$0 a month' : '$'.($plan['monthly_usd_cents'] / 100).' a month';
            $this->assertStringContainsString($plan['name'].': '.$dollars, $content, "{$plan['name']} price");
            $this->assertStringContainsString(number_format($plan['included_minutes']).' participant-minutes', $content, "{$plan['name']} allowance");
        }
    }
}
