<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Services\Billing\Money;

/**
 * Powers the "Active Services" admin dashboard: services grouped by the
 * kind of service NAI TALK sells (hosting, SSL, email, legacy...) instead
 * of one flat list, with per-group metrics so an admin can tell at a glance
 * which service areas are healthy, growing, or need attention.
 */
class ServicesDashboardController extends Controller
{
    /**
     * Every group is always returned, even with zero services, so the admin
     * sees the full shape of the business rather than only groups that
     * happen to have data today.
     */
    private const SERVICE_TYPES = [
        'hosting' => 'Hosting',
        'ssl' => 'SSL',
        'domain' => 'Domain',
        'email' => 'Email',
        'website_maintenance' => 'Website Maintenance',
        'support' => 'Support',
        'website_development' => 'Website Development',
        'custom_services' => 'Custom Services',
        'legacy_hosting_ssl' => 'Legacy Hosting + SSL',
    ];

    private const SUSPENDED_STATUSES = ['suspended', 'deactivated'];
    private const EXPIRED_STATUSES = ['expired', 'grace_period'];

    public function grouped()
    {
        $groups = collect(self::SERVICE_TYPES)->map(function (string $label, string $type) {
            return $this->metricsFor($type, $label);
        })->values();

        return response()->json(['data' => $groups]);
    }

    /**
     * @return array<string, mixed>
     */
    private function metricsFor(string $type, string $label): array
    {
        $base = HostingService::query()->where('service_type', $type);

        $activeCount = (clone $base)->where('status', 'active')->count();
        $suspendedCount = (clone $base)->whereIn('status', self::SUSPENDED_STATUSES)->count();
        $expiredCount = (clone $base)->whereIn('status', self::EXPIRED_STATUSES)->count();
        $clientCount = (clone $base)->distinct('client_id')->count('client_id');

        $pendingRenewalsCount = (clone $base)
            ->where('status', 'active')
            ->whereNotNull('renews_at')
            ->whereDate('renews_at', '>=', now()->toDateString())
            ->whereDate('renews_at', '<=', now()->addDays(30)->toDateString())
            ->count();

        $dueSoonCount = (clone $base)
            ->where('status', 'active')
            ->whereNotNull('renews_at')
            ->whereDate('renews_at', '>=', now()->toDateString())
            ->whereDate('renews_at', '<=', now()->addDays(7)->toDateString())
            ->count();

        $overdueRenewalsCount = (clone $base)
            ->where('status', 'active')
            ->whereNotNull('renews_at')
            ->whereDate('renews_at', '<', now()->toDateString())
            ->count();

        $recentlyActivatedCount = (clone $base)
            ->where(function ($query) {
                $query->whereDate('starts_at', '>=', now()->subDays(30)->toDateString())
                    ->orWhere('created_at', '>=', now()->subDays(30));
            })
            ->count();

        $expectedRenewalRevenueKobo = (int) (clone $base)
            ->whereIn('status', ['active', 'suspended'])
            ->sum('amount_kobo');

        $serviceIds = (clone $base)->pluck('id');

        $revenueGeneratedKobo = (int) Invoice::query()
            ->whereIn('hosting_service_id', $serviceIds)
            ->sum('amount_paid_kobo');

        return [
            'service_type' => $type,
            'label' => $label,
            'active_count' => $activeCount,
            'suspended_count' => $suspendedCount,
            'expired_count' => $expiredCount,
            'client_count' => $clientCount,
            'pending_renewals_count' => $pendingRenewalsCount,
            'due_soon_count' => $dueSoonCount,
            'overdue_renewals_count' => $overdueRenewalsCount,
            'recently_activated_count' => $recentlyActivatedCount,
            'revenue_generated_kobo' => $revenueGeneratedKobo,
            'revenue_generated' => Money::naira($revenueGeneratedKobo),
            'expected_renewal_revenue_kobo' => $expectedRenewalRevenueKobo,
            'expected_renewal_revenue' => Money::naira($expectedRenewalRevenueKobo),
        ];
    }
}
