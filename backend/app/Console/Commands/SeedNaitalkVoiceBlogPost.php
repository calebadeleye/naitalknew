<?php

namespace App\Console\Commands;

use App\Models\BlogPost;
use Illuminate\Console\Command;

class SeedNaitalkVoiceBlogPost extends Command
{
    protected $signature = 'blog:seed-naitalk-voice-launch';

    protected $description = 'Create or update the "Introducing NAI TALK Voice" blog post.';

    private const SLUG = 'introducing-nai-talk-voice-business-phone-line-in-your-browser';

    public function handle(): int
    {
        $content = file_get_contents(resource_path('blog-posts/'.self::SLUG.'.md'));

        $heroImage = 'https://images.pexels.com/photos/7682340/pexels-photo-7682340.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

        // Keep the original publish date when this is run again to update the text.
        $existing = BlogPost::query()->where('slug', self::SLUG)->first();

        $post = BlogPost::query()->updateOrCreate(
            ['slug' => self::SLUG],
            [
                'title' => 'Introducing NAI TALK Voice: A Nigerian Business Phone Number Your Team Answers in the Browser',
                'excerpt' => 'NAI TALK Voice gives your business a Nigerian phone number, such as a 0201 Lagos line, that your team answers in a web browser. Several people answer at once, callers hold when everyone is busy, calls can be recorded, and developers get an API with webhooks.',
                'content' => $content,
                'featured_image_url' => $heroImage,
                'featured_image_meta' => [
                    'url' => $heroImage,
                    'alt_text' => 'A customer support team wearing headsets, answering business calls on their laptops',
                    'photographer' => 'Pexels',
                    'provider_url' => 'https://www.pexels.com/photo/7682340/',
                    'source_id' => '7682340',
                    'metadata' => ['source' => 'pexels'],
                ],
                'author_name' => 'Admin',
                'status' => 'published',
                'published_at' => $existing?->published_at ?? now(),
                'seo_title' => 'NAI TALK Voice: Nigerian Business Phone Line in Your Browser',
                'seo_description' => 'A Nigerian business number (0201 Lagos) your team answers in the browser: call queues, hold music, recordings, call logs, prepaid per-minute billing and an API.',
                'og_image' => $heroImage,
            ],
        );

        $this->info("Blog post ready: #{$post->id} /{$post->slug}");

        return self::SUCCESS;
    }
}
