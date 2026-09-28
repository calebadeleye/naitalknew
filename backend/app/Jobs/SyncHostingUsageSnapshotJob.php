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
        // Imported (legacy) sites are managed from the same dashboard as
        // checkout-provisioned ones, so they get usage snapshots too.
        $query = HostingService::query()
            ->whereIn('provisioning_status', ['provisioned', 'imported_existing'])
            ->whereHas('ispConfigServiceMappings', fn ($query) => $query->whereNotNull('ispconfig_website_id'));

        if ($this->hostingServiceId) {
            $query->where('id', $this->hostingServiceId);
        }

        if (! $query->exists()) {
            return;
        }

        $sessionId = $client->login();

        // ISPConfig reports disk usage per client (`quota_get_by_user`), so
        // fetch each client once and look sites up in it.
        /** @var array<string, array<string, int>|null> $usageByClient domain_id => used KB */
        $usageByClient = [];

        try {
            $query->with(['ispConfigServiceMappings.clientMapping', 'hostingPlan'])->chunkById(100, function ($services) use ($client, $sessionId, &$usageByClient): void {
                foreach ($services as $service) {
                    $mapping = $service->ispConfigServiceMappings->first();

                    if (! $mapping || ! $mapping->ispconfig_website_id) {
                        continue;
                    }

                    $configuration = $service->hostingPlan?->configuration() ?? [];
                    $previousSnapshot = $service->latestUsageSnapshot();

                    // Disk usage depends on a separate, flakier ISPConfig call —
                    // isolate it so a failure never blocks the account counts
                    // below (those come straight from our own DB) from being recorded.
                    $diskUsedMb = $previousSnapshot?->disk_used_mb ?? 0;
                    $bandwidthUsedMb = $previousSnapshot?->bandwidth_used_mb ?? 0;
                    $ispClientId = (string) ($mapping->clientMapping?->ispconfig_client_id ?? '');

                    if ($ispClientId !== '' && ! array_key_exists($ispClientId, $usageByClient)) {
                        try {
                            $usageByClient[$ispClientId] = [];

                            foreach ($client->quotaGetByUser($sessionId, (int) $ispClientId) as $row) {
                                $usageByClient[$ispClientId][(string) ($row['domain_id'] ?? '')] = (int) ($row['used'] ?? 0);
                            }
                        } catch (IspConfigApiException $exception) {
                            $usageByClient[$ispClientId] = null;

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
                    }

                    $usedKb = $usageByClient[$ispClientId][(string) $mapping->ispconfig_website_id] ?? null;

                    if ($usedKb !== null) {
                        $diskUsedMb = (int) ceil($usedKb / 1024);
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
