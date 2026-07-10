<?php

namespace App\Jobs;

use App\Models\AuditLog;
use App\Models\DomainTransfer;
use App\Models\User;
use App\Notifications\ClientNotificationFailed;
use App\Notifications\NaiTalkDomainTransferFailed;
use App\Notifications\NaiTalkDomainTransferInitiated;
use App\Services\Domains\SpaceshipDomainTransferService;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification as NotificationFacade;

/**
 * Initiates a domain transfer through Spaceship after its invoice is fully
 * paid — dispatched by DomainOrderDispatcher, never called at request time.
 * Completion is asynchronous (real transfers take days) and tracked
 * separately by SyncDomainStatusJob.
 */
class InitiateDomainTransferJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [30, 120, 300, 900];

    public function __construct(public readonly int $domainTransferId)
    {
    }

    public function uniqueId(): string
    {
        return 'initiate-domain-transfer:'.$this->domainTransferId;
    }

    public function uniqueFor(): int
    {
        return 3600;
    }

    public function handle(SpaceshipDomainTransferService $transferService, ClientNotifier $notifier): void
    {
        $transfer = DomainTransfer::query()->with(['domain.client.user', 'client.user'])->find($this->domainTransferId);

        if (! $transfer) {
            return;
        }

        $status = $transferService->initiate($transfer);
        $client = $transfer->domain?->client ?? $transfer->client;

        AuditLog::query()->create([
            'client_id' => $transfer->client_id,
            'action' => 'domain_transfer_'.$status,
            'reason' => $status === 'transfer_initiated'
                ? "Transfer initiated for {$transfer->domain_name}."
                : "Transfer initiation failed for {$transfer->domain_name}: {$transfer->fresh()->failure_reason}",
            'source' => 'queue',
            'notify_client' => true,
            'error_details' => $status === 'transfer_failed' ? $transfer->fresh()->failure_reason : null,
        ]);

        if (! $client) {
            return;
        }

        if ($status === 'transfer_initiated') {
            $notifier->notify(
                client: $client,
                notification: new NaiTalkDomainTransferInitiated($transfer),
                template: 'domain_transfer_initiated',
                subject: "Transfer initiated for {$transfer->domain_name}",
            );

            return;
        }

        $notifier->notify(
            client: $client,
            notification: new NaiTalkDomainTransferFailed($transfer->fresh()),
            template: 'domain_transfer_failed',
            subject: "We couldn't start the transfer for {$transfer->domain_name}",
        );

        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isNotEmpty()) {
            NotificationFacade::send($admins, new ClientNotificationFailed(
                $client,
                'domain_transfer_failed',
                "Domain transfer failed for {$transfer->domain_name}",
                $transfer->fresh()->failure_reason,
            ));
        }
    }
}
