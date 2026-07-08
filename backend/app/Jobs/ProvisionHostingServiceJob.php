<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\NotificationLog;
use App\Models\ProvisioningLog;
use App\Models\User;
use App\Notifications\HostingProvisioningFailed;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Throwable;

class ProvisionHostingServiceJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [30, 120, 300, 900];

    public int $maxExceptions = 5;

    public function __construct(
        public readonly int $hostingServiceId,
        public readonly ?int $staffUserId = null,
        public readonly ?string $reason = null,
    ) {
    }

    public function uniqueId(): string
    {
        return 'provision-hosting-service:'.$this->hostingServiceId;
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function handle(IspConfigProvisioningService $provisioning): void
    {
        $service = HostingService::query()->findOrFail($this->hostingServiceId);
        $staffUser = $this->staffUserId ? User::query()->find($this->staffUserId) : null;

        $provisioning->ensureIspConfigClientForHostingService($service, $staffUser, $this->reason);
    }

    public function failed(?Throwable $exception): void
    {
        $service = HostingService::query()->find($this->hostingServiceId);

        if (! $service) {
            return;
        }

        $safeMessage = $exception instanceof IspConfigApiException
            ? $exception->safeMessage()
            : 'Provisioning failed after exhausting all retry attempts.';

        $service->forceFill(['provisioning_status' => 'provisioning_failed'])->save();

        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'order_id' => $service->order_id,
            'provider' => 'ispconfig',
            'action' => 'provision_hosting_service',
            'status' => 'failed',
            'message' => $safeMessage,
            'response_payload' => $exception instanceof IspConfigApiException ? $exception->context() : null,
            'finished_at' => now(),
        ]);

        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty()) {
            return;
        }

        NotificationFacade::send($admins, new HostingProvisioningFailed($service, $safeMessage));

        foreach ($admins as $admin) {
            NotificationLog::query()->create([
                'client_id' => $service->client_id,
                'channel' => 'mail',
                'template' => 'hosting_provisioning_failed',
                'recipient' => $admin->email,
                'status' => 'sent',
                'payload' => ['hosting_service_id' => $service->id, 'message' => $safeMessage],
                'sent_at' => now(),
            ]);
        }
    }
}
