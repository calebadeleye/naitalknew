<?php

namespace App\Jobs;

use App\Models\DatabaseRecord;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DatabaseProvisioningActionJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [15, 60, 180];

    public function __construct(
        public readonly int $databaseRecordId,
        public readonly string $action,
        public readonly array $payload = [],
    ) {
    }

    public function handle(IspConfigClient $client): void
    {
        $database = DatabaseRecord::query()->find($this->databaseRecordId);

        if (! $database) {
            return;
        }

        $service = $database->hostingService;
        $serviceMapping = $service->ispConfigServiceMappings()->first();

        if (! $serviceMapping || ! $serviceMapping->clientMapping?->ispconfig_client_id) {
            $this->fail($database, 'Hosting service has no ISPConfig client mapping yet.');

            return;
        }

        $ispConfigClientId = (int) $serviceMapping->clientMapping->ispconfig_client_id;
        $sessionId = $client->login();

        try {
            match ($this->action) {
                'create' => $this->create($client, $sessionId, $database, $ispConfigClientId),
                'reset_password' => $this->resetPassword($client, $sessionId, $database, $ispConfigClientId),
                'delete' => $this->delete($client, $sessionId, $database),
                default => throw new IspConfigApiException("Unknown database action: {$this->action}"),
            };
        } catch (IspConfigApiException $exception) {
            $this->fail($database, $exception->safeMessage(), $exception->context());
        } finally {
            $client->logout($sessionId);
        }
    }

    private function create(IspConfigClient $client, string $sessionId, DatabaseRecord $database, int $ispConfigClientId): void
    {
        // ISPConfig models the database credentials as a separate "database
        // user" object, referenced from the database record by id — not
        // fields on the database record itself.
        $remoteUserId = $client->databasesDatabaseUserAdd($sessionId, $ispConfigClientId, [
            'database_user' => $database->username,
            'database_password' => $this->payload['password'] ?? null,
        ]);

        $serverId = (int) ($database->hostingService->ispconfig_server_id ?: config('ispconfig.server_id'));

        $remoteDatabaseId = $client->databasesDatabaseAdd($sessionId, $ispConfigClientId, [
            'server_id' => $serverId,
            'type' => 'mysql',
            'database_name' => $database->database_name,
            'database_user_id' => $remoteUserId,
            'database_charset' => 'utf8',
            'remote_access' => 'n',
            'active' => 'y',
        ]);

        $database->forceFill([
            'ispconfig_database_id' => (string) $remoteDatabaseId,
            'ispconfig_database_user_id' => (string) $remoteUserId,
            'status' => 'active',
            'last_synced_at' => now(),
        ])->save();

        $this->log($database, 'create_database', 'completed', 'Database created in ISPConfig.');

        SyncHostingUsageSnapshotJob::dispatch($database->hosting_service_id, 'resource_change');
    }

    private function resetPassword(IspConfigClient $client, string $sessionId, DatabaseRecord $database, int $ispConfigClientId): void
    {
        if (! $database->ispconfig_database_user_id) {
            throw new IspConfigApiException('Database user has no ISPConfig id on record.');
        }

        $client->databasesDatabaseUserUpdate($sessionId, $ispConfigClientId, (int) $database->ispconfig_database_user_id, [
            'database_password' => $this->payload['password'] ?? null,
        ]);

        $database->forceFill(['last_synced_at' => now()])->save();

        $this->log($database, 'reset_database_password', 'completed', 'Database password reset in ISPConfig.');
    }

    private function delete(IspConfigClient $client, string $sessionId, DatabaseRecord $database): void
    {
        $client->databasesDatabaseDelete($sessionId, (int) $database->ispconfig_database_id);

        if ($database->ispconfig_database_user_id) {
            $client->databasesDatabaseUserDelete($sessionId, (int) $database->ispconfig_database_user_id);
        }

        $database->forceFill(['status' => 'deleted', 'last_synced_at' => now()])->save();
        $database->delete();

        $this->log($database, 'delete_database', 'completed', 'Database deleted from ISPConfig.');

        SyncHostingUsageSnapshotJob::dispatch($database->hosting_service_id, 'resource_change');
    }

    private function fail(DatabaseRecord $database, string $message, array $context = []): void
    {
        $database->forceFill(['status' => 'failed'])->save();

        ProvisioningLog::query()->create([
            'client_id' => $database->hostingService?->client_id,
            'hosting_service_id' => $database->hosting_service_id,
            'provider' => 'ispconfig',
            'action' => $this->action.'_database',
            'status' => 'failed',
            'message' => $message,
            'response_payload' => $context ?: null,
            'finished_at' => now(),
        ]);
    }

    private function log(DatabaseRecord $database, string $action, string $status, string $message): void
    {
        ProvisioningLog::query()->create([
            'client_id' => $database->hostingService?->client_id,
            'hosting_service_id' => $database->hosting_service_id,
            'provider' => 'ispconfig',
            'action' => $action,
            'status' => $status,
            'message' => $message,
            'finished_at' => now(),
        ]);
    }
}
