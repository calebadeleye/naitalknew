<?php

namespace App\Services\Domains;

use App\Models\DomainTransfer;
use RuntimeException;
use Throwable;

/**
 * Handles the Spaceship side of a domain transfer. The EPP/auth code is
 * only ever decrypted in memory here, immediately before the outbound
 * call — never logged, never re-persisted in cleartext.
 */
class SpaceshipDomainTransferService
{
    public function __construct(
        private readonly SpaceshipClient $client,
        private readonly SpaceshipDomainContactService $contactService,
    ) {
    }

    /**
     * A lightweight, pre-payment eligibility check. Not a guarantee — the
     * real transfer can still be rejected by the losing registrar for
     * reasons only Spaceship can see (transfer lock, wrong EPP code, etc).
     *
     * @return array{domain: string, eligible: bool, status: string}
     */
    public function checkEligibility(string $domain): array
    {
        $info = $this->client->getDomainInfo($domain);

        return [
            'domain' => $domain,
            'eligible' => isset($info['status']),
            'status' => $info['status'] ?? 'unknown',
        ];
    }

    /**
     * @return string one of transfer_initiated|transfer_failed (idempotent —
     *                returns the current status untouched if already underway).
     */
    public function initiate(DomainTransfer $transfer): string
    {
        if (in_array($transfer->transfer_status, ['transfer_completed', 'transfer_in_progress', 'transfer_initiated'], true)) {
            return $transfer->transfer_status;
        }

        $client = $transfer->domain?->client ?? $transfer->client;

        try {
            $contact = $this->contactService->contactFor($client);
        } catch (RuntimeException $exception) {
            return $this->markFailed($transfer, $exception->getMessage());
        }

        try {
            $contactSet = $this->contactService->contactSetFor($contact);
            $result = $this->client->initiateTransfer($transfer->domain_name, $transfer->epp_code_encrypted, $contactSet);

            $transfer->forceFill([
                'transfer_status' => 'transfer_initiated',
                'provider_transfer_id' => $result['operation_id'] ?? ($result['raw']['transferId'] ?? null),
                'initiated_at' => now(),
            ])->save();

            $transfer->domain?->forceFill(['transfer_status' => 'transfer_initiated'])->save();

            return 'transfer_initiated';
        } catch (Throwable $exception) {
            return $this->markFailed($transfer, $exception->getMessage());
        }
    }

    /**
     * Polls Spaceship for the live transfer status — used by
     * SyncDomainStatusJob. A transfer completing here is what makes the
     * domain available for Flow 5 (add hosting later).
     */
    public function syncStatus(DomainTransfer $transfer): string
    {
        $result = $this->client->getTransferStatus($transfer->domain_name);
        $status = $result['status'] ?? null;

        $mapped = match ($status) {
            'completed', 'success' => 'transfer_completed',
            'pending_approval' => 'transfer_pending_approval',
            'in_progress', 'pending' => 'transfer_in_progress',
            'cancelled' => 'transfer_cancelled',
            'failed' => 'transfer_failed',
            default => $transfer->transfer_status,
        };

        if ($mapped === $transfer->transfer_status) {
            return $mapped;
        }

        if ($mapped === 'transfer_completed') {
            $transfer->forceFill(['transfer_status' => 'transfer_completed', 'completed_at' => now()])->save();
            $transfer->domain?->forceFill([
                'status' => 'active',
                'source' => 'spaceship_transferred',
                'registration_status' => 'registered',
                'transfer_status' => 'transfer_completed',
            ])->save();
        } elseif ($mapped === 'transfer_failed') {
            $this->markFailed($transfer, 'Spaceship reported the transfer failed.');
        } else {
            $transfer->forceFill(['transfer_status' => $mapped])->save();
            $transfer->domain?->forceFill(['transfer_status' => $mapped])->save();
        }

        return $mapped;
    }

    private function markFailed(DomainTransfer $transfer, string $reason): string
    {
        $transfer->forceFill([
            'transfer_status' => 'transfer_failed',
            'failed_at' => now(),
            'failure_reason' => $reason,
        ])->save();

        $transfer->domain?->forceFill(['transfer_status' => 'transfer_failed'])->save();

        return 'transfer_failed';
    }
}
