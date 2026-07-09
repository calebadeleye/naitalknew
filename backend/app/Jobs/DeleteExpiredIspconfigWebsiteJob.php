<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\NotificationLog;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspconfigWebsiteStatusService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily sweep: permanently removes a suspended service's website from
 * ISPConfig once its scheduled_deletion_at date arrives — but only if the
 * final 1-day warning email was actually attempted and logged first. Never
 * hard-deletes the local HostingService row or touches the client account;
 * only marks the service 'deleted_from_ispconfig'. One service's failure
 * never blocks the rest of the sweep.
 */
class DeleteExpiredIspconfigWebsiteJob implements ShouldQueue
{
    use Queueable;

    public function handle(IspconfigWebsiteStatusService $websiteStatus): void
    {
        HostingService::query()
            ->where('status', 'suspended')
            ->whereNotNull('scheduled_deletion_at')
            ->whereDate('scheduled_deletion_at', '<=', now()->toDateString())
            ->chunkById(100, function ($services) use ($websiteStatus): void {
                foreach ($services as $service) {
                    $this->deleteOne($service, $websiteStatus);
                }
            });
    }

    private function deleteOne(HostingService $service, IspconfigWebsiteStatusService $websiteStatus): void
    {
        if (! $this->finalWarningWasSent($service)) {
            ProvisioningLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'provider' => 'ispconfig',
                'action' => 'delete_website_from_ispconfig',
                'status' => 'review_required',
                'message' => 'Scheduled deletion date reached but the final warning email was not confirmed sent — skipping automatic deletion for admin review.',
                'finished_at' => now(),
            ]);

            return;
        }

        try {
            $websiteStatus->deleteFromIspConfig($service, [
                'reason_category' => 'hosting_expired',
                'reason_note' => 'Grace period and final-warning window elapsed without renewal.',
                'notify_client' => true,
            ], null, 'system');
        } catch (IspConfigApiException) {
            // Already logged (AuditLog + ProvisioningLog) inside the
            // service — don't let one failing service abort the sweep.
        }
    }

    /**
     * Item 8 requires the final warning to have been attempted and logged
     * before deletion — "attempted" includes failed sends, since the admin
     * is separately alerted on failure and can intervene.
     */
    private function finalWarningWasSent(HostingService $service): bool
    {
        return NotificationLog::query()
            ->where('hosting_service_id', $service->id)
            ->where('template', 'hosting_final_warning_1d')
            ->exists();
    }
}
