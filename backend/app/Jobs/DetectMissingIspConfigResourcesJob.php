<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\ProvisioningLog;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Full reconciliation pass: flags services that claim to be provisioned but
 * have no ISPConfig mapping, mappings that haven't synced recently, and
 * services whose plan requires resources (email/database) that were never
 * actually created locally. Every finding is logged for admin review —
 * nothing here mutates billing state or deletes records.
 */
class DetectMissingIspConfigResourcesJob implements ShouldQueue
{
    use Queueable;

    private const STALE_SYNC_THRESHOLD_HOURS = 48;

    public function handle(): void
    {
        HostingService::query()
            ->where('provisioning_status', 'provisioned')
            ->whereDoesntHave('ispConfigServiceMappings')
            ->chunkById(100, function ($services): void {
                foreach ($services as $service) {
                    ProvisioningLog::query()->create([
                        'client_id' => $service->client_id,
                        'hosting_service_id' => $service->id,
                        'order_id' => $service->order_id,
                        'provider' => 'ispconfig',
                        'action' => 'detect_missing_ispconfig_resources',
                        'status' => 'review_required',
                        'message' => 'Laravel service is marked provisioned but no ISPConfig service mapping exists.',
                        'finished_at' => now(),
                    ]);
                }
            });

        HostingService::query()
            ->where('provisioning_status', 'provisioned')
            ->whereHas('ispConfigServiceMappings', function ($query): void {
                $query->where(function ($query): void {
                    $query->where('last_synced_at', '<', now()->subHours(self::STALE_SYNC_THRESHOLD_HOURS))
                        ->orWhereNull('last_synced_at');
                });
            })
            ->with('ispConfigServiceMappings')
            ->chunkById(100, function ($services): void {
                foreach ($services as $service) {
                    ProvisioningLog::query()->create([
                        'client_id' => $service->client_id,
                        'hosting_service_id' => $service->id,
                        'order_id' => $service->order_id,
                        'provider' => 'ispconfig',
                        'action' => 'detect_missing_ispconfig_resources',
                        'status' => 'review_required',
                        'message' => 'ISPConfig service mapping has not synced in over '.self::STALE_SYNC_THRESHOLD_HOURS.' hours.',
                        'finished_at' => now(),
                    ]);
                }
            });

        HostingService::query()
            ->where('provisioning_status', 'provisioned')
            ->with('hostingPlan')
            ->whereDoesntHave('mailboxRecords')
            ->whereDoesntHave('databaseRecords')
            ->chunkById(100, function ($services): void {
                foreach ($services as $service) {
                    $configuration = $service->hostingPlan?->configuration() ?? [];

                    if (($configuration['max_email_accounts'] ?? 0) <= 0 && ($configuration['max_databases'] ?? 0) <= 0) {
                        continue;
                    }

                    ProvisioningLog::query()->create([
                        'client_id' => $service->client_id,
                        'hosting_service_id' => $service->id,
                        'order_id' => $service->order_id,
                        'provider' => 'ispconfig',
                        'action' => 'detect_missing_ispconfig_resources',
                        'status' => 'review_required',
                        'message' => 'Plan includes email/database resources but none have been provisioned for this service yet.',
                        'finished_at' => now(),
                    ]);
                }
            });
    }
}
