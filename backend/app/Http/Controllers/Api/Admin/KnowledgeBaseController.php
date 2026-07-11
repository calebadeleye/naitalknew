<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseGroup;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class KnowledgeBaseController extends Controller
{
    public function groups()
    {
        return response()->json(['data' => KnowledgeBaseGroup::query()->orderBy('sort_order')->get()]);
    }

    public function storeGroup(Request $request)
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:knowledge_base_groups,slug'],
            'icon' => ['nullable', 'string', 'max:60'],
            'sort_order' => ['nullable', 'integer'],
        ]);
        $payload['slug'] = ($payload['slug'] ?? null) ?: Str::slug($payload['name']);

        return response()->json(KnowledgeBaseGroup::query()->create($payload), 201);
    }

    public function articles()
    {
        return response()->json(['data' => KnowledgeBaseArticle::query()->with('group')->orderBy('sort_order')->paginate(20)]);
    }

    public function storeArticle(Request $request)
    {
        $payload = $this->validateArticlePayload($request);
        $payload['slug'] = ($payload['slug'] ?? null) ?: Str::slug($payload['title']);
        $payload['last_updated_at'] = now();

        return response()->json(KnowledgeBaseArticle::query()->create($payload), 201);
    }

    public function updateArticle(Request $request, KnowledgeBaseArticle $article)
    {
        $payload = $this->validateArticlePayload($request, $article);
        $payload['slug'] = ($payload['slug'] ?? null) ?: Str::slug($payload['title']);
        $payload['last_updated_at'] = now();
        $article->update($payload);

        return response()->json($article->refresh());
    }

    public function destroyArticle(KnowledgeBaseArticle $article)
    {
        $article->delete();

        return response()->json(['message' => 'Article deleted.']);
    }

    private function validateArticlePayload(Request $request, ?KnowledgeBaseArticle $article = null): array
    {
        return $request->validate([
            'group_id' => ['required', 'exists:knowledge_base_groups,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('knowledge_base_articles', 'slug')->ignore($article?->id)],
            'summary' => ['nullable', 'string', 'max:500'],
            'content' => ['required', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
        ]);
    }
}
