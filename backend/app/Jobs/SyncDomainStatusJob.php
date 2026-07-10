<?php

namespace App\Jobs;

use App\Models\Domain;
use App\Models\DomainTransfer;
use App\Models\NotificationLog;
use App\Notifications\NaiTalkDomainTransferActionRequired;
use App\Notifications\NaiTalkDomainTransferCompleted;
use App\Notifications\NaiTalkDomainTransferFailed;
use App\Services\Domains\SpaceshipDomainSyncService;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Polls Spaceship for live status on domains mid-transfer and refreshes
 * expiry dates for registered domains. Sends the transfer-status emails
 * (action required / completed / failed) exactly once per transition,
 * deduped via NotificationLog like every other lifecycle reminder.
 */
class SyncDomainStatusJob implements ShouldQueue
{
    use Queueable;

    public function handle(SpaceshipDomainSyncService $syncService, ClientNotifier $notifier): void
    {
        $activeTransfers = DomainTransfer::query()
            ->whereIn('transfer_status', ['transfer_initiated', 'transfer_pending_approval', 'transfer_in_progress'])
            ->with(['domain.client.user', 'client.user'])
            ->get();

        foreach ($activeTransfers as $transfer) {
            $before = $transfer->transfer_status;
            $domain = $transfer->domain;

            if ($domain) {
                $syncService->syncDomain($domain);
            }

            $transfer->refresh();
            $after = $transfer->transfer_status;

            if ($before === $after) {
                continue;
            }

            $client = $domain?->client ?? $transfer->client;

            if (! $client) {
                continue;
            }

            $template = "domain_transfer_status_{$after}";

            if ($this->alreadyNotified($transfer, $template)) {
                continue;
            }

            match ($after) {
                'transfer_pending_approval' => $notifier->notify(
                    client: $client,
                    notification: new NaiTalkDomainTransferActionRequired($transfer),
                    template: $template,
                    subject: "Action required for the transfer of {$transfer->domain_name}",
                    payload: ['domain_transfer_id' => $transfer->id],
                ),
                'transfer_completed' => $notifier->notify(
                    client: $client,
                    notification: new NaiTalkDomainTransferCompleted($transfer),
                    template: $template,
                    subject: "Transfer completed for {$transfer->domain_name}",
                    payload: ['domain_transfer_id' => $transfer->id],
                ),
                'transfer_failed' => $notifier->notify(
                    client: $client,
                    notification: new NaiTalkDomainTransferFailed($transfer),
                    template: $template,
                    subject: "Transfer failed for {$transfer->domain_name}",
                    payload: ['domain_transfer_id' => $transfer->id],
                ),
                default => null,
            };
        }

        Domain::query()
            ->where('registration_status', 'registered')
            ->whereDoesntHave('transfers', fn ($query) => $query->whereIn('transfer_status', [
                'transfer_initiated', 'transfer_pending_approval', 'transfer_in_progress',
            ]))
            ->chunkById(50, function ($domains) use ($syncService): void {
                foreach ($domains as $domain) {
                    $syncService->syncDomain($domain);
                }
            });
    }

    private function alreadyNotified(DomainTransfer $transfer, string $template): bool
    {
        return NotificationLog::query()
            ->where('template', $template)
            ->whereJsonContains('payload->domain_transfer_id', $transfer->id)
            ->exists();
    }
}
