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
     */
    public function overview(?string $from = null, ?string $to = null): array
    {
        [$rangeStart, $rangeEnd] = $this->resolveRange($from, $to);

        $visits = AnalyticsVisit::query()->whereBetween('started_at', [$rangeStart, $rangeEnd]);
        $totalVisitors = (clone $visits)->distinct('visitor_id')->count('visitor_id');
        $totalVisits = (clone $visits)->count();

        $pageViews = AnalyticsPageView::query()
            ->whereBetween('viewed_at', [$rangeStart, $rangeEnd]);
        $totalPageViews = (clone $pageViews)->count();

        $avgSessionDurationSeconds = (int) round(
            AnalyticsVisit::query()
                ->whereBetween('analytics_visits.started_at', [$rangeStart, $rangeEnd])
                ->join('analytics_page_views', 'analytics_page_views.analytics_visit_id', '=', 'analytics_visits.id')
                ->selectRaw('analytics_visits.id, sum(analytics_page_views.duration_seconds) as session_duration')
                ->groupBy('analytics_visits.id')
                ->get()
                ->avg('session_duration') ?? 0
        );

        $topCountries = AnalyticsVisit::query()
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

        $visitorsByDay = AnalyticsVisit::query()
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
            'visits_over_time' => $visitsOverTime,
        ];
    }

    /**
     * Two independent funnels (see FunnelDefinitions) — each step's count is
     * the number of distinct visitors who fired that event at least once in
     * range, not a strict per-visitor linear path. That's a simplification
     * (someone could view hosting plans without ever searching a domain
     * first), but it's honest about volume and drop-off at each milestone,
     * which is what matters for "where are we losing people".
     */
    public function funnels(?string $from = null, ?string $to = null): array
    {
        [$rangeStart, $rangeEnd] = $this->resolveRange($from, $to);

        $funnels = [];
        foreach (FunnelDefinitions::FUNNELS as $key => $definition) {
            $steps = [];
            $firstCount = null;
            $previousCount = null;

            foreach ($definition['steps'] as $eventName => $label) {
                $count = AnalyticsFunnelEvent::query()
                    ->where('funnel', $key)
                    ->where('event_name', $eventName)
                    ->whereBetween('created_at', [$rangeStart, $rangeEnd])
                    ->distinct('visitor_id')
                    ->count('visitor_id');

                $firstCount ??= $count;

                $steps[] = [
                    'event_name' => $eventName,
                    'label' => $label,
                    'visitors' => $count,
                    'pct_of_previous_step' => $previousCount === null ? null : ($previousCount > 0 ? round($count / $previousCount * 100, 1) : 0.0),
                    'pct_of_first_step' => $firstCount > 0 ? round($count / $firstCount * 100, 1) : 0.0,
                ];

                $previousCount = $count;
            }

            $revenueKobo = (int) AnalyticsFunnelEvent::query()
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

    private function resolveRange(?string $from, ?string $to): array
    {
        $rangeEnd = $to ? Carbon::parse($to)->endOfDay() : now();
        $rangeStart = $from ? Carbon::parse($from)->startOfDay() : (clone $rangeEnd)->subDays(29)->startOfDay();

        return [$rangeStart, $rangeEnd];
    }
}
