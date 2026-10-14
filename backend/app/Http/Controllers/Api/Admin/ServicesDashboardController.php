<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\HostingService;
use App\Models\HostingUsageSnapshot;
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
     * "How full is the server?": every website on ISPConfig, grouped by
     * package, with the disk space each package promises against what is
     * really used, and the space left on the VPS itself. The backend runs on
     * the same VPS as the hosted sites, so the local disk is the server disk.
     */
    public function capacity()
    {
        $websites = HostingService::query()
            ->whereHas('ispConfigServiceMappings', fn ($query) => $query->whereNotNull('ispconfig_website_id'))
            ->with('hostingPlan:id,name')
            ->get(['id', 'hosting_plan_id', 'status', 'plan_type']);

        $latest = HostingUsageSnapshot::query()
            ->whereIn('id', HostingUsageSnapshot::query()->selectRaw('max(id)')->whereIn('hosting_service_id', $websites->pluck('id'))->groupBy('hosting_service_id'))
            ->get(['hosting_service_id', 'disk_used_mb', 'disk_quota_mb'])
            ->keyBy('hosting_service_id');

        $packages = $websites
            ->groupBy(fn (HostingService $service) => $service->hostingPlan?->name ?? 'No package')
            ->map(function ($services, string $name) use ($latest) {
                $live = $services->whereNotIn('status', ['cancelled', 'terminated', 'deleted']);

                return [
                    'package' => $name,
                    'active' => $services->where('status', 'active')->count(),
                    'suspended_or_expired' => $live->where('status', '!=', 'active')->count(),
                    'allocated_mb' => (int) $live->sum(fn ($s) => $latest[$s->id]->disk_quota_mb ?? 0),
                    'used_mb' => (int) $live->sum(fn ($s) => $latest[$s->id]->disk_used_mb ?? 0),
                ];
            })
            ->sortByDesc('active')
            ->values();

        // The backend lives on the same VPS disk as the hosted sites.
        $path = config('hosting_lifecycle.server_disk_path') ?: base_path();
        $total = @disk_total_space($path) ?: null;
        $free = @disk_free_space($path) ?: null;

        return response()->json([
            'websites' => [
                'active' => $packages->sum('active'),
                'suspended_or_expired' => $packages->sum('suspended_or_expired'),
            ],
            'packages' => $packages,
            'storage' => [
                'allocated_mb' => $packages->sum('allocated_mb'),
                'used_by_sites_mb' => $packages->sum('used_mb'),
            ],
            'disk' => $total ? [
                'total_mb' => (int) round($total / 1048576),
                'used_mb' => (int) round(($total - $free) / 1048576),
                'free_mb' => (int) round($free / 1048576),
                'used_percent' => round(($total - $free) / $total * 100, 1),
            ] : null,
            'checked_at' => now()->toIso8601String(),
        ]);
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
