<?php

namespace App\Console\Commands;

use App\Models\BlogPost;
use Illuminate\Console\Command;

class SeedGreenMailStoryBlogPost extends Command
{
    protected $signature = 'blog:seed-green-mail-story';

    protected $description = 'Create or update the "From Webmail to Green Mail" blog post.';

    public function handle(): int
    {
        $content = file_get_contents(resource_path('blog-posts/from-webmail-to-green-mail-professional-business-email.md'));

        $heroImage = 'https://images.pexels.com/photos/10375901/pexels-photo-10375901.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

        $post = BlogPost::query()->updateOrCreate(
            ['slug' => 'from-webmail-to-green-mail-professional-business-email'],
            [
                'title' => 'From Webmail to Green Mail: We Believe Every Business Deserves to Look the Part',
                'excerpt' => 'We started with webmail. Now Green Mail is a standalone business email service: your own domain, AI help and no website or hosting package needed.',
                'content' => $content,
                'featured_image_url' => $heroImage,
                'featured_image_meta' => [
                    'url' => $heroImage,
                    'alt_text' => 'A smiling businesswoman at her desk using a laptop and smartphone to manage her business email',
                    'photographer' => 'RDNE Stock project',
                    'provider_url' => 'https://www.pexels.com/photo/woman-in-dress-sitting-in-front-of-a-laptop-10375901/',
                    'source_id' => '10375901',
                    'metadata' => ['source' => 'pexels'],
                ],
                'author_name' => 'NAI TALK',
                'status' => 'published',
                'published_at' => now(),
                'seo_title' => 'Green Mail: Standalone Business Email in Nigeria | NAI TALK',
                'seo_description' => 'Green Mail by NAI TALK is business email on your own domain, now available on its own: no website or hosting package needed. See how it works.',
                'og_image' => $heroImage,
            ],
        );

        $this->info("Blog post ready: #{$post->id} /{$post->slug}");

        return self::SUCCESS;
    }
}
