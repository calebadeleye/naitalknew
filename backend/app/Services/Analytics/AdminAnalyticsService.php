<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsPageView;
use App\Models\AnalyticsVisit;
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
        $rangeEnd = $to ? Carbon::parse($to)->endOfDay() : now();
        $rangeStart = $from ? Carbon::parse($from)->startOfDay() : (clone $rangeEnd)->subDays(29)->startOfDay();

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

        $topPages = AnalyticsPageView::query()
            ->whereBetween('viewed_at', [$rangeStart, $rangeEnd])
            ->selectRaw('path, count(*) as views, avg(duration_seconds) as avg_duration_seconds')
            ->groupBy('path')
            ->orderByDesc('views')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'path' => $row->path,
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
}
