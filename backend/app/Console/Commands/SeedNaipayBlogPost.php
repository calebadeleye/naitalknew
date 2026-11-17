<?php

namespace App\Console\Commands;

use App\Models\BlogPost;
use Illuminate\Console\Command;

class SeedNaipayBlogPost extends Command
{
    protected $signature = 'blog:seed-naipay-launch';

    protected $description = 'Create or update the "Introducing NaiPay escrow" blog post.';

    private const SLUG = 'introducing-naipay-escrow-safe-payments-for-nigerian-buyers-and-sellers';

    public function handle(): int
    {
        $content = file_get_contents(resource_path('blog-posts/'.self::SLUG.'.md'));

        $heroImage = 'https://images.pexels.com/photos/6169668/pexels-photo-6169668.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

        // Keep the original publish date when this is run again to update the text.
        $existing = BlogPost::query()->where('slug', self::SLUG)->first();

        $post = BlogPost::query()->updateOrCreate(
            ['slug' => self::SLUG],
            [
                'title' => 'Introducing NaiPay: Escrow That Protects Nigerian Buyers and Sellers',
                'excerpt' => 'NaiPay is an escrow service from NAI TALK. The buyer pays NaiPay, the money is held until the buyer confirms delivery, then it is released to the seller. See how it works, what it costs (1.5%, shared) and how to start.',
                'content' => $content,
                'featured_image_url' => $heroImage,
                'featured_image_meta' => [
                    'url' => $heroImage,
                    'alt_text' => 'A delivery driver unloading parcels from a van, bringing an order to a buyer',
                    'photographer' => 'Pexels',
                    'provider_url' => 'https://www.pexels.com/photo/6169668/',
                    'source_id' => '6169668',
                    'metadata' => ['source' => 'pexels'],
                ],
                'author_name' => 'Admin',
                'status' => 'published',
                'published_at' => $existing?->published_at ?? now(),
                'seo_title' => 'NaiPay Escrow: Safe Payments for Nigerian Buyers and Sellers',
                'seo_description' => 'Buy and sell online in Nigeria without fear of scams. NaiPay holds the money until the buyer confirms delivery, then pays the seller. One 1.5% fee, shared.',
                'og_image' => $heroImage,
            ],
        );

        $this->info("Blog post ready: #{$post->id} /{$post->slug}");

        return self::SUCCESS;
    }
}
