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

    /**
     * This is a client-side-routed SPA with no server-rendered PHP pages, so
     * any of these appearing in a reported path is a vulnerability scanner
     * probing for a WordPress/PHP exploit, not a real page — e.g. the
     * `/ad-redirect/{encrypted-payload}` scans that showed up in production
     * analytics, which is Laravel's own encryption payload shape being
     * lobbed at random sites hoping for a deserialization bug. Not
     * exhaustive; just the well-known, high-signal cases.
     */
    private const SUSPICIOUS_PATH_MARKERS = [
        '.php', '.aspx', '.jsp', '.cgi', '.env', '.git/',
        'wp-admin', 'wp-content', 'wp-login', 'wp-json', 'wp-includes', 'xmlrpc',
        'phpmyadmin', 'pma/', 'ad-redirect', '/vendor/', 'cgi-bin',
    ];

    private const MAX_PLAUSIBLE_PATH_LENGTH = 300;

    public function pageview(Request $request, GeoIpLookupService $geoIp)
    {
        $payload = $request->validate([
            'visitor_id' => ['required', 'uuid'],
            'path' => ['required', 'string', 'max:500'],
            'title' => ['nullable', 'string', 'max:255'],
            'referrer' => ['nullable', 'string', 'max:500'],
        ]);

        if ($this->looksLikeBot($request) || $this->looksLikeJunkPath($payload['path'])) {
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
                'user_agent' => substr((string) $request->userAgent(), 0, 500),
                'device_type' => $this->detectDeviceType((string) $request->userAgent()),
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

    /**
     * A deliberately simple, dependency-free classifier — good enough to
     * split "mobile vs desktop vs tablet" for the admin analytics dashboard
     * without pulling in a full user-agent parsing library.
     */
    private function detectDeviceType(string $userAgent): string
    {
        $ua = strtolower($userAgent);

        if (str_contains($ua, 'ipad') || (str_contains($ua, 'android') && ! str_contains($ua, 'mobile'))) {
            return 'tablet';
        }

        if (str_contains($ua, 'mobile') || str_contains($ua, 'iphone') || str_contains($ua, 'ipod') || str_contains($ua, 'windows phone')) {
            return 'mobile';
        }

        return 'desktop';
    }

    private function looksLikeJunkPath(string $path): bool
    {
        if (strlen($path) > self::MAX_PLAUSIBLE_PATH_LENGTH) {
            return true;
        }

        $lowerPath = strtolower($path);
        foreach (self::SUSPICIOUS_PATH_MARKERS as $marker) {
            if (str_contains($lowerPath, $marker)) {
                return true;
            }
        }

        return false;
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
