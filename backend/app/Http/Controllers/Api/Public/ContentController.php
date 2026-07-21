<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\BlogPost;
use App\Models\Faq;
use App\Models\KnowledgeBaseGroup;
use App\Models\PageSeoMetadata;
use App\Models\ServiceStatus;
use App\Services\Media\PexelsImageService;
use Illuminate\Http\Request;

/**
 * Read-only public endpoints for the marketing site's content pages (blog,
 * knowledge base, FAQs, service status) plus the Pexels-backed image lookup
 * used for hero/card imagery. Nothing here requires authentication.
 */
class ContentController extends Controller
{
    public function blogIndex(Request $request)
    {
        $search = trim((string) $request->query('search', ''));

        $posts = BlogPost::query()
            ->published()
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner
                ->where('title', 'like', "%{$search}%")
                ->orWhere('excerpt', 'like', "%{$search}%")))
            ->orderByDesc('published_at')
            ->paginate(8);

        return response()->json([
            'data' => collect($posts->items())->map(fn (BlogPost $post) => $this->serializeBlogSummary($post)),
            'meta' => [
                'current_page' => $posts->currentPage(),
                'last_page' => $posts->lastPage(),
                'total' => $posts->total(),
            ],
            'popular' => BlogPost::query()->published()->orderByDesc('published_at')->limit(5)->get()
                ->map(fn (BlogPost $post) => ['title' => $post->title, 'slug' => $post->slug]),
        ]);
    }

    public function blogShow(string $slug)
    {
        $post = BlogPost::query()->published()->where('slug', $slug)->firstOrFail();

        $related = BlogPost::query()->published()->where('id', '!=', $post->id)->orderByDesc('published_at')->limit(3)->get();

        return response()->json([
            'data' => [
                ...$this->serializeBlogSummary($post),
                'content' => $post->content,
                'reading_time_minutes' => $post->readingTimeMinutes(),
                'seo_title' => $post->seo_title ?: $post->title,
                'seo_description' => $post->seo_description ?: $post->excerpt,
                'og_image' => $post->og_image ?: $post->featured_image_url,
            ],
            'related' => $related->map(fn (BlogPost $item) => $this->serializeBlogSummary($item)),
        ]);
    }

    private function serializeBlogSummary(BlogPost $post): array
    {
        return [
            'title' => $post->title,
            'slug' => $post->slug,
            'excerpt' => $post->excerpt,
            'featured_image_url' => $post->featured_image_url,
            'featured_image_alt' => $post->featured_image_meta['alt_text'] ?? $post->title,
            'author_name' => $post->author_name,
            'published_at' => $post->published_at?->toDateString(),
            'updated_at' => $post->updated_at?->toDateString(),
            'reading_time_minutes' => $post->readingTimeMinutes(),
        ];
    }

    public function knowledgeBaseIndex()
    {
        $groups = KnowledgeBaseGroup::query()
            ->with(['articles' => fn ($query) => $query->published()->orderBy('sort_order')])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'groups' => $groups->map(fn (KnowledgeBaseGroup $group) => [
                'name' => $group->name,
                'slug' => $group->slug,
                'icon' => $group->icon,
                'articles' => $group->articles->map(fn ($article) => [
                    'title' => $article->title,
                    'slug' => $article->slug,
                    'summary' => $article->summary,
                    'last_updated_at' => $article->last_updated_at?->toDateString(),
                ]),
            ]),
        ]);
    }

    public function knowledgeBaseShow(string $slug)
    {
        $article = \App\Models\KnowledgeBaseArticle::query()
            ->published()
            ->with('group')
            ->where('slug', $slug)
            ->firstOrFail();

        $related = \App\Models\KnowledgeBaseArticle::query()
            ->published()
            ->where('group_id', $article->group_id)
            ->where('id', '!=', $article->id)
            ->orderBy('sort_order')
            ->limit(4)
            ->get();

        return response()->json([
            'data' => [
                'title' => $article->title,
                'slug' => $article->slug,
                'summary' => $article->summary,
                'content' => $article->content,
                'group' => ['name' => $article->group->name, 'slug' => $article->group->slug],
                'last_updated_at' => $article->last_updated_at?->toDateString(),
                'seo_title' => $article->seo_title ?: $article->title,
                'seo_description' => $article->seo_description ?: $article->summary,
            ],
            'related' => $related->map(fn ($item) => ['title' => $item->title, 'slug' => $item->slug, 'summary' => $item->summary]),
        ]);
    }

    public function faqs()
    {
        $faqs = Faq::query()->published()->orderBy('group')->orderBy('sort_order')->get();

        return response()->json([
            'groups' => $faqs->groupBy('group')->map(fn ($items, $group) => [
                'group' => $group,
                'items' => $items->map(fn (Faq $faq) => ['question' => $faq->question, 'answer' => $faq->answer])->values(),
            ])->values(),
        ]);
    }

    public function serviceStatus()
    {
        $statuses = ServiceStatus::query()->orderBy('sort_order')->get();

        return response()->json([
            'overall_status' => $statuses->contains(fn (ServiceStatus $status) => $status->status === 'incident')
                ? 'incident'
                : ($statuses->contains(fn (ServiceStatus $status) => $status->status !== 'operational') ? 'degraded' : 'operational'),
            'services' => $statuses->map(fn (ServiceStatus $status) => [
                'name' => $status->service_name,
                'status' => $status->status,
                'message' => $status->message,
                'updated_at' => $status->updated_at?->toIso8601String(),
            ]),
        ]);
    }

    public function seoMetadata(Request $request)
    {
        $path = '/'.ltrim((string) $request->query('path', ''), '/');
        $override = PageSeoMetadata::query()->where('path', $path)->first();

        return response()->json([
            'data' => $override ? [
                'seo_title' => $override->seo_title,
                'meta_description' => $override->meta_description,
                'og_image' => $override->og_image,
                'canonical_url' => $override->canonical_url,
            ] : null,
        ]);
    }

    /**
     * Thin, cached, safe-by-default proxy to Pexels so the frontend never
     * needs the API key. Query is required and orientation defaults to
     * landscape, matching what hero/card imagery needs most often.
     */
    public function image(Request $request, PexelsImageService $pexels)
    {
        $payload = $request->validate([
            'query' => ['required', 'string', 'max:100'],
            'orientation' => ['nullable', 'in:landscape,portrait,square'],
        ]);

        $image = $pexels->firstImageFor($payload['query'], $payload['orientation'] ?? 'landscape');

        return response()->json(['data' => $image]);
    }
}
