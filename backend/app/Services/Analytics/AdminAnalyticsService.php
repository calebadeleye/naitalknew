<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsFunnelEvent;
use App\Models\AnalyticsPageView;
use App\Models\AnalyticsVisit;
use App\Services\Billing\Money;
use Illuminate\Support\Carbon;

class AdminAnalyticsService
{
    /**
     * $from/$to are optional inclusive date bounds (Y-m-d). When omitted,
     * the dashboard falls back to the trailing 30 days, matching
     * AdminDashboardService's convention for an unfiltered view.
     *
     * By default only "counted" visits are reported (see
     * AnalyticsVisit::scopeCounted — no suspected bots, and real
     * interaction where the browser can report it); $includeAll shows
     * everything, and filtered_out says how much was left out and why.
     */
    public function overview(?string $from = null, ?string $to = null, bool $includeAll = false): array
    {
        [$rangeStart, $rangeEnd] = $this->resolveRange($from, $to);

        $countedOnly = fn ($query) => $includeAll ? $query : $query->counted();

        $visits = $countedOnly(AnalyticsVisit::query())->whereBetween('started_at', [$rangeStart, $rangeEnd]);
        $totalVisitors = (clone $visits)->distinct('visitor_id')->count('visitor_id');
        $totalVisits = (clone $visits)->count();

        $pageViews = AnalyticsPageView::query()
            ->whereBetween('viewed_at', [$rangeStart, $rangeEnd])
            ->when(! $includeAll, fn ($query) => $query->whereIn('analytics_visit_id', AnalyticsVisit::query()->counted()->select('id')));
        $totalPageViews = (clone $pageViews)->count();

        $inRange = fn () => AnalyticsVisit::query()->whereBetween('started_at', [$rangeStart, $rangeEnd]);
        $filteredOut = [
            'suspected_bots' => $inRange()->whereNotNull('suspected_bot_reason')->count(),
            'not_engaged' => $inRange()->whereNull('suspected_bot_reason')->where('engagement_tracked', true)->whereNull('engaged_at')->count(),
        ];

        $avgSessionDurationSeconds = (int) round(
            $countedOnly(AnalyticsVisit::query())
                ->whereBetween('analytics_visits.started_at', [$rangeStart, $rangeEnd])
                ->join('analytics_page_views', 'analytics_page_views.analytics_visit_id', '=', 'analytics_visits.id')
                ->selectRaw('analytics_visits.id, sum(analytics_page_views.duration_seconds) as session_duration')
                ->groupBy('analytics_visits.id')
                ->get()
                ->avg('session_duration') ?? 0
        );

        $topCountries = $countedOnly(AnalyticsVisit::query())
            ->whereBetween('started_at', [$rangeStart, $rangeEnd])
            ->whereNotNull('country')
            ->selectRaw('country, country_code, count(*) as visits')
            ->groupBy('country', 'country_code')
            ->orderByDesc('visits')
            ->limit(10)
            ->get();

        // Grouped by path with the query string stripped — otherwise a
        // shared link's tracking params (e.g. Facebook's unique ?fbclid= per
        // click) make every visit to the same page look like a different
        // page. The raw path+query is still on each AnalyticsPageView row,
        // so campaign-level detail isn't lost, just not shown in this report.
        $topPages = AnalyticsPageView::query()
            ->whereBetween('viewed_at', [$rangeStart, $rangeEnd])
            ->when(! $includeAll, fn ($query) => $query->whereIn('analytics_visit_id', AnalyticsVisit::query()->counted()->select('id')))
            ->selectRaw("SUBSTRING_INDEX(path, '?', 1) as clean_path, count(*) as views, avg(duration_seconds) as avg_duration_seconds")
            ->groupBy('clean_path')
            ->orderByDesc('views')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'path' => $row->clean_path,
                'views' => (int) $row->views,
                'avg_duration_seconds' => (int) round($row->avg_duration_seconds),
            ]);

        $deviceBreakdown = $countedOnly(AnalyticsVisit::query())
            ->whereBetween('started_at', [$rangeStart, $rangeEnd])
            ->selectRaw("coalesce(device_type, 'unknown') as device_type, count(*) as visits")
            ->groupBy('device_type')
            ->orderByDesc('visits')
            ->get()
            ->map(fn ($row) => ['device_type' => $row->device_type, 'visits' => (int) $row->visits]);

        $visitorsByDay = $countedOnly(AnalyticsVisit::query())
            ->whereBetween('started_at', [$rangeStart, $rangeEnd])
            ->selectRaw('DATE(started_at) as date, count(distinct visitor_id) as visitors, count(*) as visits')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy('date');

        $visitsOverTime = [];
        $cursor = $rangeStart->copy()->startOfDay();
        while ($cursor->lte($rangeEnd)) {
            $key = $cursor->toDateString();
            $row = $visitorsByDay->get($key);
            $visitsOverTime[] = [
                'date' => $key,
                'visitors' => $row ? (int) $row->visitors : 0,
                'visits' => $row ? (int) $row->visits : 0,
            ];
            $cursor->addDay();
        }

        return [
            'date_range' => ['from' => $rangeStart->toDateString(), 'to' => $rangeEnd->toDateString()],
            'total_visitors' => $totalVisitors,
            'total_visits' => $totalVisits,
            'total_page_views' => $totalPageViews,
            'avg_session_duration_seconds' => $avgSessionDurationSeconds,
            'top_countries' => $topCountries,
            'top_pages' => $topPages,
            'device_breakdown' => $deviceBreakdown,
            'visits_over_time' => $visitsOverTime,
            'filtered_out' => $filteredOut,
            'include_all' => $includeAll,
            // Earliest visit ever recorded, so the chart can leave off days
            // from before tracking existed instead of showing them as empty.
            'tracking_started_on' => ($firstVisitAt = AnalyticsVisit::query()->min('started_at')) ? Carbon::parse($firstVisitAt)->toDateString() : null,
        ];
    }

    /**
     * Two independent funnels (see FunnelDefinitions) — each step's count is
     * the number of distinct visitors who fired that event at least once in
     * range, not a strict per-visitor linear path. That's a simplification
     * (someone could view hosting plans without ever searching a domain
     * first), but it's honest about volume and drop-off at each milestone,
     * which is what matters for "where are we losing people".
     *
     * Because visitors can enter mid-funnel, the 100% baseline is the first
     * step that actually has visitors (not blindly step 1) — otherwise a
     * funnel nobody enters at its first step reads as all zeros. Percent
     * fields keep their "first_step" name for API stability; a step with no
     * previous-step traffic to compare against reports null, not 0%.
     */
    public function funnels(?string $from = null, ?string $to = null, bool $includeAll = false): array
    {
        [$rangeStart, $rangeEnd] = $this->resolveRange($from, $to);

        $withoutBots = fn ($query) => $includeAll ? $query : $query->whereNotIn('visitor_id', $this->visitorsWithoutCountedVisits());

        $funnels = [];
        foreach (FunnelDefinitions::FUNNELS as $key => $definition) {
            $steps = [];
            $baselineCount = null;
            $previousCount = null;

            foreach ($definition['steps'] as $eventName => $label) {
                $count = $withoutBots(AnalyticsFunnelEvent::query())
                    ->where('funnel', $key)
                    ->where('event_name', $eventName)
                    ->whereBetween('created_at', [$rangeStart, $rangeEnd])
                    ->distinct('visitor_id')
                    ->count('visitor_id');

                if ($baselineCount === null && $count > 0) {
                    $baselineCount = $count;
                }

                $steps[] = [
                    'event_name' => $eventName,
                    'label' => $label,
                    'visitors' => $count,
                    'pct_of_previous_step' => $previousCount ? round($count / $previousCount * 100, 1) : null,
                    'pct_of_first_step' => $baselineCount ? round($count / $baselineCount * 100, 1) : 0.0,
                ];

                $previousCount = $count;
            }

            $revenueKobo = (int) $withoutBots(AnalyticsFunnelEvent::query())
                ->where('funnel', $key)
                ->where('event_name', 'purchase')
                ->whereBetween('created_at', [$rangeStart, $rangeEnd])
                ->sum('value_kobo');

            $funnels[$key] = [
                'label' => $definition['label'],
                'steps' => $steps,
                'revenue' => $revenueKobo > 0 ? Money::naira($revenueKobo) : null,
            ];
        }

        return [
            'date_range' => ['from' => $rangeStart->toDateString(), 'to' => $rangeEnd->toDateString()],
            'funnels' => $funnels,
        ];
    }

    /**
     * Visitors who have visits on record but none that count (all flagged as
     * bots, or never interacted) — their funnel events are left out. Visitors
     * with no visits at all are kept on purpose: a customer who only ever uses
     * the client portal (which isn't visit-tracked) must still have their
     * checkout and purchase counted.
     */
    private function visitorsWithoutCountedVisits()
    {
        return AnalyticsVisit::query()
            ->select('visitor_id')
            ->groupBy('visitor_id')
            ->havingRaw('sum(case when suspected_bot_reason is null and (engagement_tracked = 0 or engaged_at is not null) then 1 else 0 end) = 0');
    }

    private function resolveRange(?string $from, ?string $to): array
    {
        $rangeEnd = $to ? Carbon::parse($to)->endOfDay() : now();
        $rangeStart = $from ? Carbon::parse($from)->startOfDay() : (clone $rangeEnd)->subDays(29)->startOfDay();

        return [$rangeStart, $rangeEnd];
    }
}
