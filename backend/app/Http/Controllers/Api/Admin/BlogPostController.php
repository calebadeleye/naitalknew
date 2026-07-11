<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Services\Media\PexelsImageService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BlogPostController extends Controller
{
    public function index()
    {
        return response()->json(['data' => BlogPost::query()->latest('created_at')->paginate(20)]);
    }

    public function store(Request $request, PexelsImageService $pexels)
    {
        $payload = $this->validatePayload($request);
        $payload['slug'] = ($payload['slug'] ?? null) ?: Str::slug($payload['title']);

        if (empty($payload['featured_image_url'])) {
            $image = $pexels->firstImageFor($payload['title']);
            $payload['featured_image_url'] = $image['url'];
            $payload['featured_image_meta'] = $image;
        }

        $post = BlogPost::query()->create($payload);

        return response()->json($post, 201);
    }

    public function update(Request $request, BlogPost $blogPost)
    {
        $payload = $this->validatePayload($request, $blogPost);
        $payload['slug'] = ($payload['slug'] ?? null) ?: Str::slug($payload['title']);
        $blogPost->update($payload);

        return response()->json($blogPost->refresh());
    }

    public function destroy(BlogPost $blogPost)
    {
        $blogPost->delete();

        return response()->json(['message' => 'Blog post deleted.']);
    }

    private function validatePayload(Request $request, ?BlogPost $blogPost = null): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('blog_posts', 'slug')->ignore($blogPost?->id)],
            'excerpt' => ['nullable', 'string', 'max:500'],
            'content' => ['required', 'string'],
            'featured_image_url' => ['nullable', 'string', 'max:2048'],
            'author_name' => ['nullable', 'string', 'max:255'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'og_image' => ['nullable', 'string', 'max:2048'],
        ]);
    }
}
