<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsPageView;
use App\Models\AnalyticsVisit;
use Illuminate\Support\Carbon;

/**
 * How many real people are looking at the pages that sell something
 * (hosting, domains, website design) — as opposed to the blog or homepage.
 * Every page view is put in exactly one bucket:
 *
 *  - bots:         the visit was flagged as a suspected bot
 *  - unverifiable: the visit predates interaction tracking, so there's no way
 *                  to tell a person from a script
 *  - bounced:      interaction was tracked and there was none
 *  - verified:     interaction was tracked and happened (scroll/mouse/touch/key,
 *                  or 10+ seconds on the page)
 *
 * "Verified" means human-like behaviour from a network that isn't a known
 * bot source. It is not proof: a scraper that fakes interaction from an
 * unlisted network would still land here.
 */
class ServicePagesAnalyticsService
{
    public const GROUPS = [
        'hosting' => [
            'label' => 'Hosting',
            'pages' => ['/web-hosting', '/website-care-plans', '/business-email-hosting'],
        ],
        'domains' => [
            'label' => 'Domains',
            'pages' => ['/domains', '/domain-registration', '/domain-transfer', '/domain-renewal', '/domain-pricing'],
        ],
        'website' => [
            'label' => 'Website design & SEO',
            'pages' => ['/website-design', '/seo-services', '/get-a-website'],
        ],
    ];

    public function overview(?string $from = null, ?string $to = null): array
    {
        $rangeEnd = $to ? Carbon::parse($to)->endOfDay() : now();
        $rangeStart = $from ? Carbon::parse($from)->startOfDay() : (clone $rangeEnd)->subDays(29)->startOfDay();

        $allPaths = collect(self::GROUPS)->flatMap(fn (array $group) => $group['pages'])->values()->all();
        $placeholders = implode(',', array_fill(0, count($allPaths), '?'));

        $rows = AnalyticsPageView::query()
            ->join('analytics_visits', 'analytics_visits.id', '=', 'analytics_page_views.analytics_visit_id')
            ->whereBetween('analytics_page_views.viewed_at', [$rangeStart, $rangeEnd])
            ->whereRaw("TRIM(TRAILING '/' FROM SUBSTRING_INDEX(analytics_page_views.path, '?', 1)) in ({$placeholders})", $allPaths)
            ->get([
                'analytics_page_views.path as path',
                'analytics_visits.visitor_id as visitor_id',
                'analytics_visits.suspected_bot_reason as bot_reason',
                'analytics_visits.engagement_tracked as tracked',
                'analytics_visits.engaged_at as engaged_at',
            ]);

        $emptyBuckets = ['verified' => 0, 'unverifiable' => 0, 'bounced' => 0, 'bots' => 0];
        $pageCounts = [];
        $verifiedVisitorsByGroup = [];
        $verifiedVisitors = [];

        foreach ($rows as $row) {
            $path = rtrim(explode('?', $row->path, 2)[0], '/');
            $bucket = $this->bucketFor($row);
            $pageCounts[$path] ??= $emptyBuckets;
            $pageCounts[$path][$bucket]++;

            if ($bucket === 'verified') {
                $verifiedVisitors[$row->visitor_id] = true;
                $verifiedVisitorsByGroup[$this->groupOf($path)][$row->visitor_id] = true;
            }
        }

        $groups = [];
        $pages = [];
        $totals = $emptyBuckets + ['total' => 0];

        foreach (self::GROUPS as $key => $group) {
            $groupTotals = $emptyBuckets;

            foreach ($group['pages'] as $path) {
                $counts = $pageCounts[$path] ?? $emptyBuckets;
                $total = array_sum($counts);
                $pages[] = ['path' => $path, 'group' => $group['label']] + $counts + ['total' => $total];

                foreach ($counts as $bucket => $count) {
                    $groupTotals[$bucket] += $count;
                    $totals[$bucket] += $count;
                }
                $totals['total'] += $total;
            }

            $groups[] = [
                'key' => $key,
                'label' => $group['label'],
                'verified_visitors' => count($verifiedVisitorsByGroup[$key] ?? []),
                'verified_views' => $groupTotals['verified'],
                'total_views' => array_sum($groupTotals),
                'bot_views' => $groupTotals['bots'],
            ];
        }

        $totals['verified_visitors'] = count($verifiedVisitors);

        $verificationStart = AnalyticsVisit::query()->where('engagement_tracked', true)->min('started_at');

        return [
            'date_range' => ['from' => $rangeStart->toDateString(), 'to' => $rangeEnd->toDateString()],
            'verification_started_on' => $verificationStart ? Carbon::parse($verificationStart)->toDateString() : null,
            'groups' => $groups,
            'pages' => $pages,
            'totals' => $totals,
        ];
    }

    private function bucketFor(object $row): string
    {
        if ($row->bot_reason) {
            return 'bots';
        }

        if (! $row->tracked) {
            return 'unverifiable';
        }

        return $row->engaged_at ? 'verified' : 'bounced';
    }

    private function groupOf(string $path): ?string
    {
        foreach (self::GROUPS as $key => $group) {
            if (in_array($path, $group['pages'], true)) {
                return $key;
            }
        }

        return null;
    }
}
