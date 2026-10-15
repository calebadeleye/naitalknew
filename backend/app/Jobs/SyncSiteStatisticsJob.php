<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Services\Hosting\SiteStatisticsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Nightly: copies each active website's visitor figures from its AWStats
 * report (ISPConfig rebuilds those shortly after midnight).
 */
class SyncSiteStatisticsJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 1800;

    public function handle(SiteStatisticsService $statistics): void
    {
        HostingService::query()
            ->where('status', 'active')
            ->whereHas('ispConfigServiceMappings', fn ($query) => $query->whereNotNull('ispconfig_website_id'))
            ->chunkById(25, function ($services) use ($statistics): void {
                foreach ($services as $service) {
                    // One unreachable site must not stop the rest.
                    rescue(fn () => $statistics->sync($service), report: false);
                }
            });
    }
}
