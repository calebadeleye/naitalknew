<?php

namespace App\Console\Commands;

use App\Models\BlogPost;
use Illuminate\Console\Command;

class SeedInternetRadioBlogPost extends Command
{
    protected $signature = 'blog:seed-internet-radio-guide';

    protected $description = 'Create or update the "How to Start an Internet Radio Station in Nigeria" blog post.';

    public function handle(): int
    {
        $content = file_get_contents(resource_path('blog-posts/how-to-start-an-internet-radio-station-in-nigeria.md'));

        $heroImage = 'https://images.pexels.com/photos/7598545/pexels-photo-7598545.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

        $post = BlogPost::query()->updateOrCreate(
            ['slug' => 'how-to-start-an-internet-radio-station-in-nigeria'],
            [
                'title' => 'How to Start an Internet Radio Station in Nigeria: A Complete Guide',
                'excerpt' => 'A complete guide to launching an internet radio station in Nigeria: how it works, what you need, what it costs, how to monetise it, and how NAI TALK can build the technology behind your station.',
                'content' => $content,
                'featured_image_url' => $heroImage,
                'featured_image_meta' => [
                    'url' => $heroImage,
                    'alt_text' => 'A radio presenter in a modern studio broadcasting with a microphone and headphones',
                    'photographer' => 'cottonbro studio',
                    'provider_url' => 'https://www.pexels.com/photo/women-in-a-studio-7598545/',
                    'source_id' => '7598545',
                    'metadata' => ['source' => 'pexels'],
                ],
                'author_name' => 'Admin',
                'status' => 'published',
                'published_at' => now(),
                'seo_title' => 'How to Start an Internet Radio Station in Nigeria',
                'seo_description' => 'Learn how to start an internet radio station in Nigeria: how online radio works, what equipment and software you need, costs, monetisation, and how NAI TALK can help.',
                'og_image' => $heroImage,
            ],
        );

        $this->info("Blog post ready: #{$post->id} /{$post->slug}");

        return self::SUCCESS;
    }
}
