<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Analytics\AdminAnalyticsService;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function overview(Request $request, AdminAnalyticsService $analytics)
    {
        $payload = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'include_all' => ['nullable', 'boolean'],
        ]);

        return response()->json($analytics->overview($payload['from'] ?? null, $payload['to'] ?? null, $request->boolean('include_all')));
    }

    public function funnels(Request $request, AdminAnalyticsService $analytics)
    {
        $payload = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'include_all' => ['nullable', 'boolean'],
        ]);

        return response()->json($analytics->funnels($payload['from'] ?? null, $payload['to'] ?? null, $request->boolean('include_all')));
    }
}
