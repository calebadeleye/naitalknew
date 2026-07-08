<?php

namespace App\Jobs;

use App\Models\IspConfigClientMapping;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Finds ISPConfig clients that exist remotely but have no corresponding
 * Laravel mapping, and flags each one individually for admin review.
 * Never creates/deletes Laravel records automatically.
 */
class DetectOrphanedIspConfigClientsJob implements ShouldQueue
{
    use Queueable;

    public function handle(IspConfigClient $client): void
    {
        try {
            $sessionId = $client->login();
        } catch (IspConfigApiException $exception) {
            ProvisioningLog::query()->create([
                'provider' => 'ispconfig',
                'action' => 'detect_orphaned_ispconfig_clients',
                'status' => 'sync_failed',
                'message' => $exception->safeMessage(),
                'finished_at' => now(),
            ]);

            return;
        }

        try {
            $remoteClients = $client->clientList($sessionId);
        } finally {
            $client->logout($sessionId);
        }

        $knownRemoteIds = IspConfigClientMapping::query()
            ->whereNotNull('ispconfig_client_id')
            ->pluck('ispconfig_client_id')
            ->all();

        foreach ($remoteClients as $remoteClientRecord) {
            $remoteId = (string) ($remoteClientRecord['client_id'] ?? '');

            if ($remoteId === '' || in_array($remoteId, $knownRemoteIds, true)) {
                continue;
            }

            ProvisioningLog::query()->create([
                'provider' => 'ispconfig',
                'action' => 'detect_orphaned_ispconfig_clients',
                'status' => 'review_required',
                'message' => "ISPConfig client {$remoteId} has no matching Laravel client mapping.",
                'request_payload' => ['ispconfig_client_id' => $remoteId],
                'finished_at' => now(),
            ]);
        }
    }
}
