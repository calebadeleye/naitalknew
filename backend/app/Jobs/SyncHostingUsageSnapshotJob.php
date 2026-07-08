<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\HostingUsageSnapshot;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Lightweight usage sync — appends a fresh HostingUsageSnapshot row per
 * active hosting service so the client dashboard never needs a live
 * ISPConfig call to show disk/bandwidth usage.
 */
class SyncHostingUsageSnapshotJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ?int $hostingServiceId = null, public readonly string $source = 'scheduled_sync')
    {
    }

    public function handle(IspConfigClient $client): void
    {
        $query = HostingService::query()
            ->where('provisioning_status', 'provisioned')
            ->whereHas('ispConfigServiceMappings', fn ($query) => $query->whereNotNull('ispconfig_website_id'));

        if ($this->hostingServiceId) {
            $query->where('id', $this->hostingServiceId);
        }

        if (! $query->exists()) {
            return;
        }

        $sessionId = $client->login();

        try {
            $query->with(['ispConfigServiceMappings', 'hostingPlan'])->chunkById(100, function ($services) use ($client, $sessionId): void {
                foreach ($services as $service) {
                    $mapping = $service->ispConfigServiceMappings->first();

                    if (! $mapping || ! $mapping->ispconfig_website_id) {
                        continue;
                    }

                    $configuration = $service->hostingPlan?->configuration() ?? [];
                    $previousSnapshot = $service->latestUsageSnapshot();

                    // Disk/bandwidth usage depends on a separate, flakier ISPConfig call —
                    // isolate it so a traffic-usage failure never blocks the account counts
                    // below (those come straight from our own DB) from being recorded.
                    $diskUsedMb = $previousSnapshot?->disk_used_mb ?? 0;
                    $bandwidthUsedMb = $previousSnapshot?->bandwidth_used_mb ?? 0;

                    try {
                        $usage = $client->sitesWebDomainGetTrafficUsage($sessionId, (int) $mapping->ispconfig_website_id);
                        $diskUsedMb = (int) (($usage['disk_bytes'] ?? 0) / 1024 / 1024);
                        $bandwidthUsedMb = (int) (($usage['traffic_bytes'] ?? 0) / 1024 / 1024);
                    } catch (IspConfigApiException $exception) {
                        ProvisioningLog::query()->create([
                            'client_id' => $service->client_id,
                            'hosting_service_id' => $service->id,
                            'provider' => 'ispconfig',
                            'action' => 'sync_usage_snapshot',
                            'status' => 'sync_failed',
                            'message' => $exception->safeMessage(),
                            'finished_at' => now(),
                        ]);
                    }

                    HostingUsageSnapshot::query()->create([
                        'hosting_service_id' => $service->id,
                        'disk_used_mb' => $diskUsedMb,
                        'disk_quota_mb' => $configuration['disk_quota_mb'] ?? 0,
                        'bandwidth_used_mb' => $bandwidthUsedMb,
                        'bandwidth_quota_mb' => $configuration['bandwidth_quota_mb'] ?? 0,
                        'email_accounts_used' => $service->mailboxRecords()->count(),
                        'email_accounts_limit' => $configuration['max_email_accounts'] ?? 0,
                        'databases_used' => $service->databaseRecords()->count(),
                        'databases_limit' => $configuration['max_databases'] ?? 0,
                        'ftp_accounts_used' => $service->ftpAccountRecords()->count(),
                        'ftp_accounts_limit' => $configuration['max_ftp_accounts'] ?? 0,
                        'ssh_sftp_enabled' => (bool) ($configuration['ssh_access_enabled'] ?? false) || (bool) ($configuration['sftp_access_enabled'] ?? false),
                        'captured_at' => now(),
                        'source' => $this->source,
                    ]);
                }
            });
        } finally {
            $client->logout($sessionId);
        }
    }
}
