<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Notifications\HostingSuspendedGracePeriodEnded;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily sweep: once a service's grace period has ended without renewal,
 * schedule its eventual ISPConfig deletion and queue turning off hosting
 * now (via the shared DeactivateIspconfigWebsiteJob — never talks to
 * ISPConfig directly here).
 */
class SuspendExpiredHostingJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        HostingService::query()
            ->whereIn('status', ['expired', 'grace_period'])
            ->whereNotNull('grace_period_ends_at')
            ->whereDate('grace_period_ends_at', '<=', now()->toDateString())
            ->chunkById(100, function ($services): void {
                foreach ($services as $service) {
                    $this->suspendOne($service);
                }
            });
    }

    private function suspendOne(HostingService $service): void
    {
        $deletionDate = now()
            ->addDays((int) config('hosting_lifecycle.deletion_notice_days_after_suspension'))
            ->toDateString();

        $service->forceFill(['scheduled_deletion_at' => $deletionDate])->save();

        DeactivateIspconfigWebsiteJob::dispatch(
            hostingServiceId: $service->id,
            reason: [
                'reason_category' => 'hosting_expired',
                'reason_note' => 'Grace period ended without renewal.',
                'notify_client' => true,
            ],
            staffUserId: null,
            isSecurityAction: false,
            source: 'system',
            targetStatus: 'suspended',
            notificationOverrideMeta: [
                'class' => HostingSuspendedGracePeriodEnded::class,
                'template' => 'hosting_suspended_grace_period_ended',
                'subject' => 'Your NAI TALK hosting has been suspended',
            ],
        );
    }
}
