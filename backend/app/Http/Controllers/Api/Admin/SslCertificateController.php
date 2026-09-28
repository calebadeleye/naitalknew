<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncIspConfigHostingServicesJob;
use App\Models\HostingService;
use Illuminate\Support\Carbon;

/**
 * Admin-only view of what SSL certificates are actually being served across
 * every live website — not what ISPConfig's own "SSL enabled" flag claims.
 * Exists because that flag can read true for weeks after the real
 * certificate has silently expired (see LiveCertificateChecker); this page
 * is meant to catch that before a client notices instead of after.
 */
class SslCertificateController extends Controller
{
    private const WARNING_WINDOW_DAYS = 14;

    public function index()
    {
        return response()->json(['data' => $this->overview()]);
    }

    /**
     * Queues the same job the 6-hourly schedule runs, for every site, rather
     * than waiting for the next cycle. Runs on the queue (up to ~30 sites,
     * each a live TLS handshake) rather than inline, so this request doesn't
     * hang on a slow or unreachable one.
     */
    public function refresh()
    {
        SyncIspConfigHostingServicesJob::dispatch();

        return response()->json(['message' => 'Refresh queued. Reload in a moment to see updated results.', 'data' => $this->overview()], 202);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function overview(): array
    {
        return HostingService::query()
            ->where('status', 'active')
            ->whereIn('provisioning_status', ['provisioned', 'imported_existing'])
            ->whereHas('ispConfigServiceMappings', fn ($query) => $query->whereNotNull('ispconfig_website_id'))
            ->with(['client.user', 'hostingPlan'])
            ->get()
            ->map(fn (HostingService $service) => [
                'hosting_service_id' => $service->id,
                'domain' => $service->primary_domain,
                'client' => $service->client?->company_name ?: $service->client?->user?->name,
                'plan' => $service->hostingPlan?->name,
                'ssl_active' => (bool) $service->website_ssl_active,
                'ssl_expires_at' => $service->website_ssl_expires_at?->toIso8601String(),
                'days_remaining' => $this->daysRemaining($service->website_ssl_expires_at),
                'status' => $this->status($service),
                'checked_at' => $service->website_settings_synced_at?->toIso8601String(),
            ])
            ->sortBy(fn (array $row) => $row['days_remaining'] ?? -999999)
            ->values()
            ->all();
    }

    private function daysRemaining(?Carbon $expiresAt): ?int
    {
        return $expiresAt ? (int) now()->diffInDays($expiresAt, false) : null;
    }

    private function status(HostingService $service): string
    {
        if (! $service->website_settings_synced_at) {
            return 'unchecked';
        }

        if (! $service->website_ssl_active) {
            return 'not_active';
        }

        $days = $this->daysRemaining($service->website_ssl_expires_at);

        return $days !== null && $days <= self::WARNING_WINDOW_DAYS ? 'expiring_soon' : 'active';
    }
}
