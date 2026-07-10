<?php

namespace App\Jobs;

use App\Models\AuditLog;
use App\Models\DomainOrder;
use App\Models\User;
use App\Notifications\ClientNotificationFailed;
use App\Notifications\NaiTalkDomainRegistrationConfirmed;
use App\Notifications\NaiTalkDomainRegistrationFailed;
use App\Services\Domains\SpaceshipDomainRegistrationService;
use App\Services\Notifications\ClientNotifier;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Notification as NotificationFacade;

/**
 * Registers a domain through Spaceship after its invoice is fully paid —
 * dispatched by DomainOrderDispatcher, never called at request time. On
 * success, queues the linked hosting service's provisioning (domain first,
 * hosting second — never the reverse). On failure, the domain is never
 * marked registered and hosting is never provisioned.
 */
class RegisterDomainWithSpaceshipJob implements ShouldQueue, ShouldBeUnique
{
    use InteractsWithQueue, Queueable;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [30, 120, 300, 900];

    public function __construct(public readonly int $domainOrderId)
    {
    }

    public function uniqueId(): string
    {
        return 'register-domain:'.$this->domainOrderId;
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function handle(SpaceshipDomainRegistrationService $registrationService, IspConfigProvisioningService $provisioning, ClientNotifier $notifier): void
    {
        $domainOrder = DomainOrder::query()->with(['domain.client.user', 'hostingService'])->find($this->domainOrderId);

        if (! $domainOrder) {
            return;
        }

        $status = $registrationService->register($domainOrder);

        if ($status === 'pending') {
            $this->release(30);

            return;
        }

        $domain = $domainOrder->domain;
        $client = $domain?->client;

        AuditLog::query()->create([
            'client_id' => $domainOrder->client_id,
            'action' => 'domain_registration_'.$status,
            'reason' => $status === 'registered'
                ? "Domain {$domainOrder->domain_name} registered via Spaceship."
                : "Domain {$domainOrder->domain_name} registration failed: {$domainOrder->fresh()->error_message}",
            'source' => 'queue',
            'notify_client' => true,
            'error_details' => $status === 'failed' ? $domainOrder->fresh()->error_message : null,
        ]);

        if ($status === 'registered') {
            if ($domainOrder->hosting_service_id && $domainOrder->hostingService) {
                $provisioning->queueProvisioning($domainOrder->hostingService);
            }

            if ($client) {
                $notifier->notify(
                    client: $client,
                    notification: new NaiTalkDomainRegistrationConfirmed($domain),
                    template: 'domain_registration_confirmed',
                    subject: "Your domain {$domainOrder->domain_name} is registered",
                );
            }

            return;
        }

        // Failed — never provision hosting for a domain that failed to register.
        if ($client) {
            $notifier->notify(
                client: $client,
                notification: new NaiTalkDomainRegistrationFailed($domainOrder->fresh()),
                template: 'domain_registration_failed',
                subject: "We couldn't register {$domainOrder->domain_name}",
            );
        }

        $this->notifyAdmins($domainOrder);
    }

    private function notifyAdmins(DomainOrder $domainOrder): void
    {
        $client = $domainOrder->domain?->client;
        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty() || ! $client) {
            return;
        }

        NotificationFacade::send($admins, new ClientNotificationFailed(
            $client,
            'domain_registration_failed',
            "Domain registration failed for {$domainOrder->domain_name}",
            $domainOrder->fresh()->error_message,
        ));
    }
}
