<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\WebsiteSettingsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Re-writes the blocked-IP rule on every website on ISPConfig, after the
 * admin's all-websites list changes. Sites whose rule is already up to date
 * are read but not written.
 */
class ApplyIpBlocksJob implements ShouldQueue
{
    use Queueable;

    public int $timeout = 900;

    public function handle(WebsiteSettingsService $settings): void
    {
        HostingService::query()
            ->whereNotIn('status', ['cancelled', 'terminated', 'deleted'])
            ->whereHas('ispConfigServiceMappings', fn ($query) => $query->whereNotNull('ispconfig_website_id'))
            ->chunkById(25, function ($services) use ($settings): void {
                foreach ($services as $service) {
                    try {
                        $settings->applyIpBlocks($service);
                    } catch (IspConfigApiException $exception) {
                        ProvisioningLog::query()->create([
                            'client_id' => $service->client_id,
                            'hosting_service_id' => $service->id,
                            'provider' => 'ispconfig',
                            'action' => 'apply_ip_blocks',
                            'status' => 'failed',
                            'message' => $exception->safeMessage(),
                            'finished_at' => now(),
                        ]);
                    }
                }
            });
    }
}
