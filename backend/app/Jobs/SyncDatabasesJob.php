<?php

namespace App\Jobs;

use App\Models\DatabaseRecord;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncDatabasesJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ?int $hostingServiceId = null)
    {
    }

    public function handle(IspConfigClient $client): void
    {
        $query = DatabaseRecord::query()->whereNotNull('ispconfig_database_id');

        if ($this->hostingServiceId) {
            $query->where('hosting_service_id', $this->hostingServiceId);
        }

        if (! $query->exists()) {
            return;
        }

        $sessionId = $client->login();

        try {
            $query->chunkById(100, function ($databases) use ($client, $sessionId): void {
                foreach ($databases as $database) {
                    try {
                        $remote = $client->databasesDatabaseGet($sessionId, (int) $database->ispconfig_database_id);

                        if ($remote === null) {
                            $database->forceFill(['status' => 'missing_remote', 'last_synced_at' => now()])->save();

                            ProvisioningLog::query()->create([
                                'hosting_service_id' => $database->hosting_service_id,
                                'provider' => 'ispconfig',
                                'action' => 'sync_database',
                                'status' => 'review_required',
                                'message' => "Database {$database->database_name} no longer exists in ISPConfig.",
                                'finished_at' => now(),
                            ]);

                            continue;
                        }

                        $database->forceFill(['status' => 'active', 'last_synced_at' => now()])->save();
                    } catch (IspConfigApiException $exception) {
                        ProvisioningLog::query()->create([
                            'hosting_service_id' => $database->hosting_service_id,
                            'provider' => 'ispconfig',
                            'action' => 'sync_database',
                            'status' => 'sync_failed',
                            'message' => $exception->safeMessage(),
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
