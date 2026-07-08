<?php

namespace App\Jobs;

use App\Models\IspConfigClientMapping;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Client-level technical sync. Never touches billing/account fields —
 * only sync_status/last_synced_at and review-required log entries.
 */
class SyncIspConfigClientMappingsJob implements ShouldQueue
{
    use Queueable;

    public function handle(IspConfigClient $client): void
    {
        $query = IspConfigClientMapping::query()->whereNotNull('ispconfig_client_id');

        if (! $query->exists()) {
            return;
        }

        $sessionId = $client->login();

        try {
            $query->chunkById(100, function ($mappings) use ($client, $sessionId): void {
                foreach ($mappings as $mapping) {
                    try {
                        $remote = $client->clientGet($sessionId, (int) $mapping->ispconfig_client_id);

                        if ($remote === null) {
                            $mapping->forceFill([
                                'sync_status' => 'sync_flagged_for_review',
                                'last_synced_at' => now(),
                            ])->save();

                            ProvisioningLog::query()->create([
                                'client_id' => $mapping->client_id,
                                'provider' => 'ispconfig',
                                'action' => 'sync_client_mapping',
                                'status' => 'review_required',
                                'message' => 'ISPConfig client id on record no longer resolves to a remote client.',
                                'request_payload' => ['mapping_id' => $mapping->id],
                                'finished_at' => now(),
                            ]);

                            continue;
                        }

                        $mapping->forceFill([
                            'sync_status' => 'provisioned',
                            'last_synced_at' => now(),
                        ])->save();
                    } catch (IspConfigApiException $exception) {
                        ProvisioningLog::query()->create([
                            'client_id' => $mapping->client_id,
                            'provider' => 'ispconfig',
                            'action' => 'sync_client_mapping',
                            'status' => 'sync_failed',
                            'message' => $exception->safeMessage(),
                            'request_payload' => ['mapping_id' => $mapping->id],
                            'finished_at' => now(),
                        ]);
                    }
                }
            });
        } finally {
            $client->logout($sessionId);
        }
    }
}
