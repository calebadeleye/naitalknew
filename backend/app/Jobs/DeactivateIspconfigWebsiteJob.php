<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\NotificationLog;
use App\Models\ProvisioningLog;
use App\Models\User;
use App\Notifications\IspConfigActionFailed;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspconfigWebsiteStatusService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * The single queued entry point for turning off a hosting service's website
 * in ISPConfig — used by manual admin "Deactivate Website" / "Suspend
 * Service" actions and by the automatic grace-period-end suspension job.
 * All the actual work (ISPConfig call, status change, audit log, client
 * email) lives in IspconfigWebsiteStatusService; this job only resolves
 * arguments and gets Laravel's retry/backoff for free.
 */
class DeactivateIspconfigWebsiteJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [30, 120, 300, 900];

    /**
     * @param  array{reason_category: string, reason_note: string, notify_client?: bool, effective_at?: ?string, supporting_reference?: ?string}  $reason
     * @param  array{template: string, subject: string}|null  $notificationOverrideMeta  identifies which notification class to send instead of the generic one; resolved inside handle() to avoid serializing a Notification object onto the queue
     */
    public function __construct(
        public readonly int $hostingServiceId,
        public readonly array $reason,
        public readonly ?int $staffUserId = null,
        public readonly bool $isSecurityAction = false,
        public readonly string $source = 'admin',
        public readonly string $targetStatus = 'deactivated',
        public readonly ?array $notificationOverrideMeta = null,
    ) {
    }

    public function uniqueId(): string
    {
        return 'deactivate-ispconfig-website:'.$this->hostingServiceId;
    }

    public function uniqueFor(): int
    {
        return 600;
    }

    public function handle(IspconfigWebsiteStatusService $websiteStatus): void
    {
        $service = HostingService::query()->findOrFail($this->hostingServiceId);
        $staff = $this->staffUserId ? User::query()->find($this->staffUserId) : null;

        $notificationOverride = null;

        if ($this->notificationOverrideMeta) {
            $class = $this->notificationOverrideMeta['class'];
            $notificationOverride = [
                'notification' => new $class($service),
                'template' => $this->notificationOverrideMeta['template'],
                'subject' => $this->notificationOverrideMeta['subject'],
            ];
        }

        $websiteStatus->deactivate(
            $service,
            $this->reason,
            $staff,
            $this->isSecurityAction,
            $this->source,
            $this->targetStatus,
            $notificationOverride,
        );
    }

    public function failed(?Throwable $exception): void
    {
        $service = HostingService::query()->find($this->hostingServiceId);

        if (! $service) {
            return;
        }

        $safeMessage = $exception instanceof IspConfigApiException
            ? $exception->safeMessage()
            : 'Deactivating this website in ISPConfig failed after exhausting all retry attempts.';

        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'provider' => 'ispconfig',
            'action' => 'deactivate_website',
            'status' => 'failed',
            'message' => $safeMessage,
            'finished_at' => now(),
        ]);

        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send($admins, new IspConfigActionFailed($service, 'deactivate_website', $safeMessage));

        foreach ($admins as $admin) {
            NotificationLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'channel' => 'mail',
                'template' => 'ispconfig_action_failed',
                'subject' => 'ISPConfig website deactivation failed',
                'recipient' => $admin->email,
                'status' => 'sent',
                'payload' => ['hosting_service_id' => $service->id, 'action' => 'deactivate_website', 'message' => $safeMessage],
                'sent_at' => now(),
            ]);
        }
    }
}
