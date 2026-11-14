<?php

namespace Tests\Feature;

use App\Models\BlogPost;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The NAI TALK Voice launch article: published once, with the SEO fields filled in, linking to the voice site and naming no carrier or client. */
class NaitalkVoiceBlogPostTest extends TestCase
{
    use RefreshDatabase;

    private const SLUG = 'introducing-nai-talk-voice-business-phone-line-in-your-browser';

    public function test_the_command_publishes_the_article_with_its_seo_fields_and_can_be_run_again(): void
    {
        $this->artisan('blog:seed-naitalk-voice-launch')->assertSuccessful();

        $post = BlogPost::query()->where('slug', self::SLUG)->firstOrFail();
        $this->assertSame('published', $post->status);
        $this->assertLessThanOrEqual(60, mb_strlen($post->seo_title));
        $this->assertLessThanOrEqual(160, mb_strlen($post->seo_description));
        $this->assertStringContainsString('NAI TALK Voice', $post->seo_title);
        $this->assertNotEmpty($post->featured_image_meta['alt_text']);
        $this->assertStringStartsWith('https://', $post->og_image);
        $this->assertLessThanOrEqual(500, mb_strlen($post->excerpt));
        $this->assertGreaterThanOrEqual(1, substr_count($post->content, "\n## "));

        $publishedAt = $post->published_at;
        $this->artisan('blog:seed-naitalk-voice-launch')->assertSuccessful();
        $this->assertSame(1, BlogPost::query()->where('slug', self::SLUG)->count());
        $this->assertTrue($publishedAt->equalTo(BlogPost::query()->where('slug', self::SLUG)->first()->published_at), 'running it again keeps the publish date');

        $this->getJson('/api/v1/public/blog/'.self::SLUG)->assertOk()->assertJsonPath('data.slug', self::SLUG);
    }

    public function test_the_article_links_to_the_voice_site_and_names_no_carrier_or_client(): void
    {
        $content = file_get_contents(resource_path('blog-posts/'.self::SLUG.'.md'));

        $this->assertStringContainsString('](https://voice.naitalk.com)', $content);
        $this->assertStringContainsString('](https://voice.naitalk.com/docs)', $content);

        foreach (["Africa's Talking", 'Africas Talking', 'STN', 'Hello Dokta', 'Asterisk'] as $name) {
            $this->assertStringNotContainsStringIgnoringCase($name, $content, "mentions {$name}");
        }
    }
}
