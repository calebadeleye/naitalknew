<?php

namespace App\Jobs;

use App\Models\IspConfigServiceMapping;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Technical status sync for hosting service websites. Only ever updates
 * technical_status/last_synced_at/last_error — never billing/status fields
 * on the HostingService itself. Discrepancies are flagged for admin review.
 */
class SyncIspConfigHostingServicesJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ?int $hostingServiceId = null)
    {
    }

    public function handle(IspConfigClient $client): void
    {
        $query = IspConfigServiceMapping::query()->whereNotNull('ispconfig_website_id');

        if ($this->hostingServiceId) {
            $query->where('hosting_service_id', $this->hostingServiceId);
        }

        if (! $query->exists()) {
            return;
        }

        $sessionId = $client->login();

        try {
            $query->chunkById(100, function ($mappings) use ($client, $sessionId): void {
                foreach ($mappings as $mapping) {
                    try {
                        $remote = $client->sitesWebDomainGet($sessionId, (int) $mapping->ispconfig_website_id);

                        if ($remote === null) {
                            $mapping->forceFill([
                                'technical_status' => 'missing_remote',
                                'last_synced_at' => now(),
                                'last_reconciled_at' => now(),
                                'last_error' => 'Website no longer exists in ISPConfig.',
                            ])->save();

                            ProvisioningLog::query()->create([
                                'client_id' => $mapping->hostingService?->client_id,
                                'hosting_service_id' => $mapping->hosting_service_id,
                                'provider' => 'ispconfig',
                                'action' => 'sync_hosting_service',
                                'status' => 'review_required',
                                'message' => 'ISPConfig website id on record no longer resolves to a remote site.',
                                'request_payload' => ['service_mapping_id' => $mapping->id],
                                'finished_at' => now(),
                            ]);

                            continue;
                        }

                        $remoteStatus = ($remote['active'] ?? 'y') === 'y' ? 'active' : 'disabled';

                        if ($remoteStatus !== $mapping->technical_status) {
                            ProvisioningLog::query()->create([
                                'client_id' => $mapping->hostingService?->client_id,
                                'hosting_service_id' => $mapping->hosting_service_id,
                                'provider' => 'ispconfig',
                                'action' => 'sync_hosting_service',
                                'status' => 'review_required',
                                'message' => "Technical status drifted from '{$mapping->technical_status}' to '{$remoteStatus}'.",
                                'request_payload' => ['service_mapping_id' => $mapping->id],
                                'finished_at' => now(),
                            ]);
                        }

                        $mapping->forceFill([
                            'technical_status' => $remoteStatus,
                            'last_synced_at' => now(),
                            'last_reconciled_at' => now(),
                            'last_error' => null,
                        ])->save();
                    } catch (IspConfigApiException $exception) {
                        $mapping->forceFill(['last_error' => $exception->safeMessage()])->save();

                        ProvisioningLog::query()->create([
                            'client_id' => $mapping->hostingService?->client_id,
                            'hosting_service_id' => $mapping->hosting_service_id,
                            'provider' => 'ispconfig',
                            'action' => 'sync_hosting_service',
                            'status' => 'sync_failed',
                            'message' => $exception->safeMessage(),
                            'request_payload' => ['service_mapping_id' => $mapping->id],
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
