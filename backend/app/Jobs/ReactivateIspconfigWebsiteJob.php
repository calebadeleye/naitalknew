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
 * The single queued entry point for turning a hosting service's ISPConfig
 * website back on. Mirrors DeactivateIspconfigWebsiteJob.
 */
class ReactivateIspconfigWebsiteJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [30, 120, 300, 900];

    /**
     * @param  array{reason_category: string, reason_note: string, notify_client?: bool, effective_at?: ?string, supporting_reference?: ?string}  $reason
     */
    public function __construct(
        public readonly int $hostingServiceId,
        public readonly array $reason,
        public readonly ?int $staffUserId = null,
        public readonly string $source = 'admin',
    ) {
    }

    public function uniqueId(): string
    {
        return 'reactivate-ispconfig-website:'.$this->hostingServiceId;
    }

    public function uniqueFor(): int
    {
        return 600;
    }

    public function handle(IspconfigWebsiteStatusService $websiteStatus): void
    {
        $service = HostingService::query()->findOrFail($this->hostingServiceId);
        $staff = $this->staffUserId ? User::query()->find($this->staffUserId) : null;

        $websiteStatus->reactivate($service, $this->reason, $staff, $this->source);
    }

    public function failed(?Throwable $exception): void
    {
        $service = HostingService::query()->find($this->hostingServiceId);

        if (! $service) {
            return;
        }

        $safeMessage = $exception instanceof IspConfigApiException
            ? $exception->safeMessage()
            : 'Reactivating this website in ISPConfig failed after exhausting all retry attempts.';

        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'provider' => 'ispconfig',
            'action' => 'reactivate_website',
            'status' => 'failed',
            'message' => $safeMessage,
            'finished_at' => now(),
        ]);

        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty()) {
            return;
        }

        Notification::send($admins, new IspConfigActionFailed($service, 'reactivate_website', $safeMessage));

        foreach ($admins as $admin) {
            NotificationLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'channel' => 'mail',
                'template' => 'ispconfig_action_failed',
                'subject' => 'ISPConfig website reactivation failed',
                'recipient' => $admin->email,
                'status' => 'sent',
                'payload' => ['hosting_service_id' => $service->id, 'action' => 'reactivate_website', 'message' => $safeMessage],
                'sent_at' => now(),
            ]);
        }
    }
}
