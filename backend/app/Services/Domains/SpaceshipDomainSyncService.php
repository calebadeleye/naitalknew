<?php

namespace App\Services\Domains;

use App\Models\Domain;
use App\Models\DomainTransfer;
use Illuminate\Support\Carbon;

/**
 * Polls Spaceship for a domain's live status — used by SyncDomainStatusJob
 * and the admin "retry transfer status sync" action.
 */
class SpaceshipDomainSyncService
{
    public function __construct(
        private readonly SpaceshipClient $client,
        private readonly SpaceshipDomainTransferService $transferService,
    ) {
    }

    public function syncDomain(Domain $domain): void
    {
        $transfer = DomainTransfer::query()
            ->where('domain_id', $domain->id)
            ->whereIn('transfer_status', ['transfer_initiated', 'transfer_pending_approval', 'transfer_in_progress'])
            ->latest()
            ->first();

        if ($transfer) {
            $this->transferService->syncStatus($transfer);

            return;
        }

        if ($domain->registration_status !== 'registered') {
            return;
        }

        $info = $this->client->getDomainInfo($domain->domain_name);

        if (isset($info['expirationDate'])) {
            $domain->forceFill(['expires_at' => Carbon::parse($info['expirationDate'])->toDateString()])->save();
        }
    }
}
