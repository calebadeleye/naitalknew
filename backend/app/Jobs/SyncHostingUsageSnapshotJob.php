<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\HostingUsageSnapshot;
use App\Models\ProvisioningLog;
use App\Services\Hosting\HostingUsageAlertService;
use App\Services\Hosting\SiteStatisticsService;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Lightweight usage sync — appends a fresh HostingUsageSnapshot row per
 * active hosting service so the client dashboard never needs a live
 * ISPConfig call to show disk/bandwidth usage.
 *
 * A package's space covers website files, email and databases together, so
 * disk_used_mb is their total (with the three parts kept alongside it), and
 * bandwidth is this calendar month's web traffic. After each snapshot the
 * client is warned by email if storage or bandwidth is running out.
 */
class SyncHostingUsageSnapshotJob implements ShouldQueue
{
    use Queueable;

    private const BYTES_PER_MB = 1_048_576;

    public function __construct(public readonly ?int $hostingServiceId = null, public readonly string $source = 'scheduled_sync')
    {
    }

    public function handle(IspConfigClient $client, HostingUsageAlertService $alerts): void
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

        // ISPConfig reports usage per client, so fetch each client once and
        // look every one of its sites up in that. Each part is null when its
        // call failed — that part then keeps its last known value.
        /** @var array<string, array{web: ?array, mail: ?array, databases: ?array, traffic: ?array}> $usageByClient */
        $usageByClient = [];

        try {
            $query->with(['ispConfigServiceMappings.clientMapping', 'hostingPlan', 'databaseRecords'])->chunkById(100, function ($services) use ($client, $sessionId, &$usageByClient, $alerts): void {
                foreach ($services as $service) {
                    $mapping = $service->ispConfigServiceMappings->first();

                    if (! $mapping || ! $mapping->ispconfig_website_id) {
                        continue;
                    }

                    $configuration = $service->hostingPlan?->configuration() ?? [];
                    $previous = $service->latestUsageSnapshot();
                    $ispClientId = (string) ($mapping->clientMapping?->ispconfig_client_id ?? '');

                    if ($ispClientId !== '' && ! array_key_exists($ispClientId, $usageByClient)) {
                        $usageByClient[$ispClientId] = $this->fetchClientUsage($client, $sessionId, (int) $ispClientId, $service);
                    }

                    $usage = $usageByClient[$ispClientId] ?? ['web' => null, 'mail' => null, 'databases' => null, 'traffic' => null];
                    $websiteId = (string) $mapping->ispconfig_website_id;

                    $webMb = $this->webUsedMb($usage['web'], $websiteId) ?? $previous?->web_used_mb ?? $previous?->disk_used_mb ?? 0;
                    $mailMb = $this->mailUsedMb($usage['mail'], (string) $service->primary_domain) ?? $previous?->mail_used_mb ?? 0;
                    $databaseMb = $this->databaseUsedMb($usage['databases'], $websiteId, $service->databaseRecords->pluck('database_name')->filter()->all()) ?? $previous?->database_used_mb ?? 0;
                    $bandwidthMb = $this->bandwidthUsedMb($usage['traffic'], (string) $service->primary_domain, $websiteId) ?? $previous?->bandwidth_used_mb ?? 0;
                    // ISPConfig's traffic counter has read 0 when its log
                    // pipeline was down; the AWStats figures are a second source.
                    $bandwidthMb = max($bandwidthMb, SiteStatisticsService::bandwidthThisMonthMb($service));

                    $snapshot = HostingUsageSnapshot::query()->create([
                        'hosting_service_id' => $service->id,
                        'disk_used_mb' => $webMb + $mailMb + $databaseMb,
                        'web_used_mb' => $webMb,
                        'mail_used_mb' => $mailMb,
                        'database_used_mb' => $databaseMb,
                        'disk_quota_mb' => $configuration['disk_quota_mb'] ?? 0,
                        'bandwidth_used_mb' => $bandwidthMb,
                        'bandwidth_quota_mb' => $configuration['bandwidth_quota_mb'] ?? 0,
                        'email_accounts_used' => $service->mailboxRecords()->count(),
                        'email_accounts_limit' => $configuration['max_email_accounts'] ?? 0,
                        'databases_used' => $service->databaseRecords->count(),
                        'databases_limit' => $configuration['max_databases'] ?? 0,
                        'ftp_accounts_used' => $service->ftpAccountRecords()->count(),
                        'ftp_accounts_limit' => $configuration['max_ftp_accounts'] ?? 0,
                        'ssh_sftp_enabled' => (bool) ($configuration['ssh_access_enabled'] ?? false) || (bool) ($configuration['sftp_access_enabled'] ?? false),
                        'captured_at' => now(),
                        'source' => $this->source,
                    ]);

                    $alerts->check($service, $snapshot);
                }
            });
        } finally {
            $client->logout($sessionId);
        }
    }

    /**
     * @return array{web: ?array<string, int>, mail: ?array, databases: ?array, traffic: ?array}
     */
    private function fetchClientUsage(IspConfigClient $client, string $sessionId, int $ispClientId, HostingService $service): array
    {
        $attempt = function (string $what, callable $call) use ($service) {
            try {
                return $call();
            } catch (IspConfigApiException $exception) {
                ProvisioningLog::query()->create([
                    'client_id' => $service->client_id,
                    'hosting_service_id' => $service->id,
                    'provider' => 'ispconfig',
                    'action' => 'sync_usage_snapshot',
                    'status' => 'sync_failed',
                    'message' => "{$what}: ".$exception->safeMessage(),
                    'finished_at' => now(),
                ]);

                return null;
            }
        };

        return [
            // domain_id => used KB (quota_get_by_user reports kilobytes)
            'web' => $attempt('website disk usage', function () use ($client, $sessionId, $ispClientId) {
                $byWebsite = [];

                foreach ($client->quotaGetByUser($sessionId, $ispClientId) as $row) {
                    $byWebsite[(string) ($row['domain_id'] ?? '')] = (int) ($row['used'] ?? 0);
                }

                return $byWebsite;
            }),
            'mail' => $attempt('email usage', fn () => $client->mailQuotaGetByUser($sessionId, $ispClientId)),
            'databases' => $attempt('database usage', fn () => $client->databaseQuotaGetByUser($sessionId, $ispClientId)),
            'traffic' => $attempt('bandwidth usage', fn () => $client->trafficQuotaGetByUser($sessionId, $ispClientId)),
        ];
    }

    /** @param  array<string, int>|null  $byWebsite */
    private function webUsedMb(?array $byWebsite, string $websiteId): ?int
    {
        if ($byWebsite === null || ! array_key_exists($websiteId, $byWebsite)) {
            return null;
        }

        return (int) ceil($byWebsite[$websiteId] / 1024);
    }

    /** Every mailbox on the service's own domain (mailquota_get_by_user reports bytes). */
    private function mailUsedMb(?array $mailboxes, string $domain): ?int
    {
        if ($mailboxes === null || $domain === '') {
            return null;
        }

        $suffix = '@'.strtolower($domain);
        $bytes = collect($mailboxes)
            ->filter(fn (array $mailbox) => str_ends_with(strtolower((string) ($mailbox['email'] ?? '')), $suffix))
            ->sum(fn (array $mailbox) => (int) ($mailbox['used_raw'] ?? 0));

        return (int) ceil($bytes / self::BYTES_PER_MB);
    }

    /**
     * Databases attached to this website in ISPConfig, plus any created for
     * this service from the client dashboard (those can have no parent
     * website set). Bytes, per databasequota_get_by_user.
     *
     * @param  array<int, string>  $serviceDatabaseNames
     */
    private function databaseUsedMb(?array $databases, string $websiteId, array $serviceDatabaseNames): ?int
    {
        if ($databases === null) {
            return null;
        }

        $bytes = collect($databases)
            ->filter(fn (array $database) => (string) ($database['parent_domain_id'] ?? '') === $websiteId
                || in_array((string) ($database['database_name'] ?? ''), $serviceDatabaseNames, true))
            ->sum(fn (array $database) => (int) ($database['used_raw'] ?? 0));

        return (int) ceil($bytes / self::BYTES_PER_MB);
    }

    /** This calendar month's web traffic for the website (trafficquota_get_by_user reports bytes). */
    private function bandwidthUsedMb(?array $traffic, string $domain, string $websiteId): ?int
    {
        if ($traffic === null) {
            return null;
        }

        $row = $traffic[$domain] ?? collect($traffic)->first(fn ($row) => (string) (((array) $row)['domain_id'] ?? '') === $websiteId);

        if ($row === null) {
            return null;
        }

        return (int) ceil(((int) (((array) $row)['this_month'] ?? 0)) / self::BYTES_PER_MB);
    }
}
