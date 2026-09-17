<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsFunnelEvent;
use App\Models\AnalyticsPageView;
use App\Models\AnalyticsVisit;
use App\Services\Analytics\FunnelDefinitions;
use App\Services\Analytics\GeoIpLookupService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * First-party visit tracking for the admin analytics dashboard. Deliberately
 * not named "analytics" in the URL/response shape beyond what's needed —
 * this is a same-origin API endpoint the site's own frontend calls, not a
 * third-party script, so it isn't subject to the ad-blocker/consent issues
 * a Google Analytics or GTM tag would be.
 */
class TrackingController extends Controller
{
    private const SESSION_GAP_MINUTES = 30;

    private const BOT_USER_AGENT_MARKERS = [
        'bot', 'spider', 'crawl', 'slurp', 'curl/', 'wget/', 'python-requests', 'headlesschrome',
    ];

    public function pageview(Request $request, GeoIpLookupService $geoIp)
    {
        $payload = $request->validate([
            'visitor_id' => ['required', 'uuid'],
            'path' => ['required', 'string', 'max:500'],
            'title' => ['nullable', 'string', 'max:255'],
            'referrer' => ['nullable', 'string', 'max:500'],
        ]);

        if ($this->looksLikeBot($request)) {
            return response()->json(['ignored' => true], 202);
        }

        $now = now();

        $visit = AnalyticsVisit::query()
            ->where('visitor_id', $payload['visitor_id'])
            ->where('last_seen_at', '>=', $now->copy()->subMinutes(self::SESSION_GAP_MINUTES))
            ->orderByDesc('last_seen_at')
            ->first();

        if (! $visit) {
            $geo = $geoIp->lookup((string) $request->ip());

            $visit = AnalyticsVisit::query()->create([
                'visitor_id' => $payload['visitor_id'],
                'entry_path' => $payload['path'],
                'referrer' => $payload['referrer'] ?? null,
                'country' => $geo['country'],
                'country_code' => $geo['country_code'],
                'city' => $geo['city'],
                'ip_hash' => hash('sha256', $request->ip().config('app.key')),
                'started_at' => $now,
                'last_seen_at' => $now,
            ]);
        } else {
            $visit->update(['last_seen_at' => $now]);
        }

        $pageView = $visit->pageViews()->create([
            'path' => $payload['path'],
            'title' => $payload['title'] ?? null,
            'viewed_at' => $now,
        ]);

        return response()->json(['page_view_id' => $pageView->id]);
    }

    public function heartbeat(Request $request)
    {
        $payload = $request->validate([
            'page_view_id' => ['required', 'integer', 'exists:analytics_page_views,id'],
            'duration_seconds' => ['required', 'integer', 'min:0', 'max:21600'],
        ]);

        $pageView = AnalyticsPageView::query()->find($payload['page_view_id']);
        if (! $pageView) {
            return response()->json(['ignored' => true], 202);
        }

        $pageView->update(['duration_seconds' => $payload['duration_seconds']]);
        $pageView->visit()->update(['last_seen_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function event(Request $request)
    {
        $payload = $request->validate([
            'visitor_id' => ['required', 'uuid'],
            'funnel' => ['required', 'string', Rule::in(array_keys(FunnelDefinitions::FUNNELS))],
            'event_name' => ['required', 'string'],
            'properties' => ['nullable', 'array'],
            'value_kobo' => ['nullable', 'integer', 'min:0'],
        ]);

        if (! FunnelDefinitions::isValidEvent($payload['funnel'], $payload['event_name'])) {
            return response()->json(['message' => 'Unknown funnel event.'], 422);
        }

        if ($this->looksLikeBot($request)) {
            return response()->json(['ignored' => true], 202);
        }

        AnalyticsFunnelEvent::query()->create([
            'visitor_id' => $payload['visitor_id'],
            'funnel' => $payload['funnel'],
            'event_name' => $payload['event_name'],
            'properties' => $payload['properties'] ?? null,
            'value_kobo' => $payload['value_kobo'] ?? null,
        ]);

        return response()->json(['ok' => true], 201);
    }

    private function looksLikeBot(Request $request): bool
    {
        $userAgent = strtolower((string) $request->userAgent());

        if ($userAgent === '') {
            return true;
        }

        foreach (self::BOT_USER_AGENT_MARKERS as $marker) {
            if (str_contains($userAgent, $marker)) {
                return true;
            }
        }

        return false;
    }
}
