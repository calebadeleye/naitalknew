<?php

namespace App\Jobs;

use App\Models\AuditLog;
use App\Models\HostingService;
use App\Models\ProvisioningLog;
use App\Notifications\HostingExpiredNotice;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily sweep: any 'active' service whose renews_at date has passed moves to
 * 'expired' and starts its grace period. Never touches ISPConfig — the
 * website stays live during the grace period, only the local status and
 * grace_period_ends_at change.
 */
class CheckExpiredHostingServicesJob implements ShouldQueue
{
    use Queueable;

    public function handle(ClientNotifier $notifier): void
    {
        HostingService::query()
            ->where('status', 'active')
            ->whereNotNull('renews_at')
            ->whereDate('renews_at', '<', now()->toDateString())
            ->chunkById(100, function ($services) use ($notifier): void {
                foreach ($services as $service) {
                    $this->expireOne($service, $notifier);
                }
            });
    }

    private function expireOne(HostingService $service, ClientNotifier $notifier): void
    {
        $before = $service->only(['status', 'expired_at', 'grace_period_ends_at']);
        $graceEndsAt = now()->addDays((int) config('hosting_lifecycle.grace_period_days'))->toDateString();

        $service->forceFill([
            'status' => 'expired',
            'expired_at' => now(),
            'grace_period_ends_at' => $graceEndsAt,
        ])->save();

        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'provider' => 'ispconfig',
            'action' => 'hosting_expired',
            'status' => 'completed',
            'message' => "Hosting expired; grace period ends {$graceEndsAt}.",
            'finished_at' => now(),
        ]);

        AuditLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => 'hosting_expired',
            'reason' => 'Renewal date passed without payment.',
            'reason_category' => 'hosting_expired',
            'notify_client' => true,
            'effective_at' => now(),
            'source' => 'queue',
            'before_state' => $before,
            'after_state' => $service->only(['status', 'expired_at', 'grace_period_ends_at']),
        ]);

        $notifier->notify(
            client: $service->client,
            notification: new HostingExpiredNotice($service),
            template: 'hosting_expired',
            subject: 'Your NAI TALK hosting has expired',
            service: $service,
        );
    }
}
