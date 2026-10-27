<?php

namespace App\Services\NaitalkCall;

use App\Models\NaitalkCallTenant;
use App\Models\NaitalkCallUsageEvent;
use Illuminate\Support\Carbon;

/**
 * Participant-minutes from the metered participant_left events: one person
 * in a call for one minute is one participant-minute. Minutes round up.
 */
class NaitalkCallUsage
{
    /** Minutes this month per tenant id, for many tenants at once. */
    public function minutesThisMonth(?array $tenantIds = null): array
    {
        return NaitalkCallUsageEvent::query()
            ->where('left_at', '>=', now()->startOfMonth())
            ->when($tenantIds !== null, fn ($q) => $q->whereIn('tenant_id', $tenantIds))
            ->groupBy('tenant_id')
            ->selectRaw('tenant_id, SUM(seconds) as total')
            ->pluck('total', 'tenant_id')
            ->map(fn ($seconds) => self::minutes((int) $seconds))
            ->all();
    }

    /** Every day of $month so far: [['date' => 'Y-m-d', 'minutes' => int], …]. */
    public function daily(NaitalkCallTenant $tenant, Carbon $month): array
    {
        $start = $month->copy()->startOfMonth();
        $end = $month->isSameMonth(now()) ? now() : $month->copy()->endOfMonth();
        $byDay = NaitalkCallUsageEvent::query()
            ->where('tenant_id', $tenant->id)
            ->whereBetween('left_at', [$start, $month->copy()->endOfMonth()])
            ->get(['left_at', 'seconds'])
            ->groupBy(fn ($event) => $event->left_at->toDateString())
            ->map(fn ($events) => (int) $events->sum('seconds'));

        $days = [];
        for ($day = $start->copy(); $day->lte($end); $day->addDay()) {
            $days[] = ['date' => $day->toDateString(), 'minutes' => self::minutes($byDay[$day->toDateString()] ?? 0)];
        }

        return $days;
    }

    /** The last $count months, newest first: [['month' => 'Y-m', 'minutes' => int], …]. */
    public function monthly(NaitalkCallTenant $tenant, int $count = 6): array
    {
        $months = [];
        for ($i = 0; $i < $count; $i++) {
            $month = now()->startOfMonth()->subMonthsNoOverflow($i);
            $seconds = (int) NaitalkCallUsageEvent::query()
                ->where('tenant_id', $tenant->id)
                ->whereBetween('left_at', [$month, $month->copy()->endOfMonth()])
                ->sum('seconds');
            $months[] = ['month' => $month->format('Y-m'), 'minutes' => self::minutes($seconds)];
        }

        return $months;
    }

    public static function minutes(int $seconds): int
    {
        return (int) ceil($seconds / 60);
    }

    /** Whole percent of the plan's allowance used (0 when the plan has none). */
    public static function percent(int $minutes, int $included): int
    {
        return $included > 0 ? (int) floor($minutes * 100 / $included) : 0;
    }
}
