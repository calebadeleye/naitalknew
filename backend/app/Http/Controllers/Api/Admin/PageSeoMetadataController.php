<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PageSeoMetadata;
use Illuminate\Http\Request;

class PageSeoMetadataController extends Controller
{
    public function index()
    {
        return response()->json(['data' => PageSeoMetadata::query()->orderBy('path')->get()]);
    }

    public function upsert(Request $request)
    {
        $payload = $request->validate([
            'path' => ['required', 'string', 'max:255'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'og_image' => ['nullable', 'string', 'max:2048'],
            'canonical_url' => ['nullable', 'string', 'max:2048'],
        ]);
        $payload['path'] = '/'.ltrim($payload['path'], '/');

        $entry = PageSeoMetadata::query()->updateOrCreate(['path' => $payload['path']], $payload);

        return response()->json($entry);
    }
}
