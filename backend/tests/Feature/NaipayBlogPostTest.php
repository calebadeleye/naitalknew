<?php

namespace Tests\Feature;

use App\Models\BlogPost;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The NaiPay launch article: published once, with the SEO fields filled in, linking to NaiPay and naming no payment provider. */
class NaipayBlogPostTest extends TestCase
{
    use RefreshDatabase;

    private const SLUG = 'introducing-naipay-escrow-safe-payments-for-nigerian-buyers-and-sellers';

    public function test_the_command_publishes_the_article_with_its_seo_fields_and_can_be_run_again(): void
    {
        $this->artisan('blog:seed-naipay-launch')->assertSuccessful();

        $post = BlogPost::query()->where('slug', self::SLUG)->firstOrFail();
        $this->assertSame('published', $post->status);
        $this->assertLessThanOrEqual(60, mb_strlen($post->seo_title));
        $this->assertLessThanOrEqual(160, mb_strlen($post->seo_description));
        $this->assertStringContainsString('NaiPay', $post->seo_title);
        $this->assertNotEmpty($post->featured_image_meta['alt_text']);
        $this->assertStringStartsWith('https://', $post->og_image);
        $this->assertLessThanOrEqual(500, mb_strlen($post->excerpt));
        $this->assertGreaterThanOrEqual(1, substr_count($post->content, "\n## "));

        $publishedAt = $post->published_at;
        $this->artisan('blog:seed-naipay-launch')->assertSuccessful();
        $this->assertSame(1, BlogPost::query()->where('slug', self::SLUG)->count());
        $this->assertTrue($publishedAt->equalTo(BlogPost::query()->where('slug', self::SLUG)->first()->published_at), 'running it again keeps the publish date');

        $this->getJson('/api/v1/public/blog/'.self::SLUG)->assertOk()->assertJsonPath('data.slug', self::SLUG);
    }

    public function test_the_article_links_to_naipay_and_names_no_payment_provider(): void
    {
        $content = file_get_contents(resource_path('blog-posts/'.self::SLUG.'.md'));

        $this->assertStringContainsString('](https://naipay.naitalk.com)', $content);
        $this->assertStringContainsString('1.5%', $content);

        foreach (['Flutterwave', 'Squad', 'Paystack'] as $name) {
            $this->assertStringNotContainsStringIgnoringCase($name, $content, "mentions {$name}");
        }
    }
}
