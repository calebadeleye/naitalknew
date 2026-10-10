<?php

namespace App\Services\Hosting;

use App\Models\HostingService;
use App\Models\HostingUsageSnapshot;
use App\Models\NotificationLog;
use App\Notifications\HostingUsageWarning;
use App\Services\Notifications\ClientNotifier;

/**
 * Emails a client when a hosting service is running out of storage (files +
 * email + databases, which share the package's space) or of this month's
 * bandwidth. Two levels — 80% and 95% — and each is sent at most once per
 * resource per calendar month; once the 95% warning has gone out, the 80%
 * one is not sent again that month.
 */
class HostingUsageAlertService
{
    /** Highest first, so a service already past 95% gets that warning, not the 80% one. */
    private const LEVELS = [95, 80];

    public function __construct(private readonly ClientNotifier $notifier) {}

    public function check(HostingService $service, HostingUsageSnapshot $snapshot): void
    {
        if ($service->status !== 'active' || ! $service->client) {
            return;
        }

        $this->checkResource($service, 'storage', (int) $snapshot->disk_used_mb, (int) $snapshot->disk_quota_mb, [
            'website_files_mb' => (int) ($snapshot->web_used_mb ?? 0),
            'email_mb' => (int) ($snapshot->mail_used_mb ?? 0),
            'databases_mb' => (int) ($snapshot->database_used_mb ?? 0),
        ]);

        $this->checkResource($service, 'bandwidth', (int) $snapshot->bandwidth_used_mb, (int) $snapshot->bandwidth_quota_mb, []);
    }

    /** @param  array<string, int>  $breakdown */
    private function checkResource(HostingService $service, string $resource, int $usedMb, int $quotaMb, array $breakdown): void
    {
        // A quota of 0 (or less) means unlimited / not configured — nothing to warn about.
        if ($quotaMb <= 0) {
            return;
        }

        $percent = $usedMb / $quotaMb * 100;
        $level = collect(self::LEVELS)->first(fn (int $threshold) => $percent >= $threshold);

        if ($level === null) {
            return;
        }

        $month = now()->format('Y-m');

        foreach (self::LEVELS as $sentLevel) {
            if ($sentLevel >= $level && $this->alreadySent($service, "usage_{$resource}_{$sentLevel}_{$month}")) {
                return;
            }
        }

        $label = $resource === 'storage' ? 'storage space' : 'bandwidth';

        $this->notifier->notify(
            client: $service->client,
            notification: new HostingUsageWarning($service, $resource, $level, $usedMb, $quotaMb, $breakdown),
            template: "usage_{$resource}_{$level}_{$month}",
            subject: "Your website {$service->primary_domain} has used {$level}% of its {$label}",
            service: $service,
            payload: ['resource' => $resource, 'level' => $level, 'used_mb' => $usedMb, 'quota_mb' => $quotaMb] + $breakdown,
        );
    }

    private function alreadySent(HostingService $service, string $template): bool
    {
        return NotificationLog::query()
            ->where('hosting_service_id', $service->id)
            ->where('template', $template)
            ->where('status', 'sent')
            ->exists();
    }
}
