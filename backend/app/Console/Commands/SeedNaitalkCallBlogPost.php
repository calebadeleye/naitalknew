<?php

namespace App\Console\Commands;

use App\Models\BlogPost;
use Illuminate\Console\Command;

class SeedNaitalkCallBlogPost extends Command
{
    protected $signature = 'blog:seed-naitalk-call-launch';

    protected $description = 'Create or update the "Introducing Naitalk Call" blog post.';

    public function handle(): int
    {
        $content = file_get_contents(resource_path('blog-posts/introducing-naitalk-call-voice-calls-for-developers.md'));

        $heroImage = 'https://images.pexels.com/photos/6803542/pexels-photo-6803542.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

        // Keep the original publish date when this is run again to update the text.
        $existing = BlogPost::query()->where('slug', 'introducing-naitalk-call-voice-calls-for-developers')->first();

        $post = BlogPost::query()->updateOrCreate(
            ['slug' => 'introducing-naitalk-call-voice-calls-for-developers'],
            [
                'title' => 'Introducing Naitalk Call: Hosted Voice Calls for Your App, With Naira Pricing',
                'excerpt' => 'Naitalk Call gives developers hosted LiveKit voice calls and audio rooms for web, iOS and Android apps. See what you can build, how it works, what each plan includes, and how to pay in Naira.',
                'content' => $content,
                'featured_image_url' => $heroImage,
                'featured_image_meta' => [
                    'url' => $heroImage,
                    'alt_text' => 'A developer wearing headphones coding on a laptop, building voice calls into an app',
                    'photographer' => 'cottonbro studio',
                    'provider_url' => 'https://www.pexels.com/photo/man-sitting-at-the-desk-in-an-office-and-using-a-computer-6803542/',
                    'source_id' => '6803542',
                    'metadata' => ['source' => 'pexels'],
                ],
                'author_name' => 'Admin',
                'status' => 'published',
                'published_at' => $existing?->published_at ?? now(),
                'seo_title' => 'Naitalk Call: Voice Call API for App Developers | NAI TALK',
                'seo_description' => 'Hosted LiveKit voice calls and audio rooms for web, iOS and Android apps. Free plan to build, paid from $20 a month, with Naira pricing at the CBN rate.',
                'og_image' => $heroImage,
            ],
        );

        $this->info("Blog post ready: #{$post->id} /{$post->slug}");

        return self::SUCCESS;
    }
}
