<?php

namespace App\Jobs;

use App\Models\MailboxRecord;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Performs the actual ISPConfig call for a single mailbox mutation
 * (create/update/delete) that was already validated + persisted locally
 * (in a 'provisioning' state) by the controller before dispatch.
 */
class MailboxProvisioningActionJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [15, 60, 180];

    public function __construct(
        public readonly int $mailboxRecordId,
        public readonly string $action,
        public readonly array $payload = [],
    ) {
    }

    public function handle(IspConfigClient $client): void
    {
        $mailbox = MailboxRecord::query()->find($this->mailboxRecordId);

        if (! $mailbox) {
            return;
        }

        $service = $mailbox->hostingService;
        $serviceMapping = $service->ispConfigServiceMappings()->first();

        if (! $serviceMapping || ! $serviceMapping->clientMapping?->ispconfig_client_id) {
            $this->fail($mailbox, 'Hosting service has no ISPConfig client mapping yet.');

            return;
        }

        $ispConfigClientId = (int) $serviceMapping->clientMapping->ispconfig_client_id;
        $sessionId = $client->login();

        try {
            match ($this->action) {
                'create' => $this->create($client, $sessionId, $mailbox, $ispConfigClientId),
                'update' => $this->update($client, $sessionId, $mailbox, $ispConfigClientId),
                'suspend' => $this->setReceivingEnabled($client, $sessionId, $mailbox, $ispConfigClientId, false),
                'resume' => $this->setReceivingEnabled($client, $sessionId, $mailbox, $ispConfigClientId, true),
                'delete' => $this->delete($client, $sessionId, $mailbox),
                default => throw new IspConfigApiException("Unknown mailbox action: {$this->action}"),
            };
        } catch (IspConfigApiException $exception) {
            $this->fail($mailbox, $exception->safeMessage(), $exception->context());
        } finally {
            $client->logout($sessionId);
        }
    }

    private function create(IspConfigClient $client, string $sessionId, MailboxRecord $mailbox, int $ispConfigClientId): void
    {
        $remoteId = $client->mailUserAdd($sessionId, $ispConfigClientId, [
            'email' => $mailbox->email_address,
            'login' => $mailbox->email_address,
            'password' => $this->payload['password'] ?? null,
            'quota' => $mailbox->quota_mb,
            'name' => $mailbox->display_name,
            // ISPConfig defaults new mailboxes to disabled — these must be
            // explicit or the account exists but never actually receives mail.
            'postfix' => 'y',
            'access' => 'y',
        ]);

        $mailbox->forceFill([
            'ispconfig_mailbox_id' => (string) $remoteId,
            'status' => 'active',
            'last_synced_at' => now(),
        ])->save();

        $this->log($mailbox, 'create_mailbox', 'completed', 'Mailbox created in ISPConfig.');

        SyncHostingUsageSnapshotJob::dispatch($mailbox->hosting_service_id, 'resource_change');
    }

    private function update(IspConfigClient $client, string $sessionId, MailboxRecord $mailbox, int $ispConfigClientId): void
    {
        $client->mailUserUpdate($sessionId, $ispConfigClientId, (int) $mailbox->ispconfig_mailbox_id, array_filter([
            'name' => $this->payload['display_name'] ?? null,
            'quota' => $this->payload['quota_mb'] ?? null,
            'password' => $this->payload['password'] ?? null,
        ], fn ($value) => $value !== null));

        $mailbox->forceFill(array_filter([
            'display_name' => $this->payload['display_name'] ?? null,
            'quota_mb' => $this->payload['quota_mb'] ?? null,
            'status' => $this->payload['status'] ?? null,
            'last_synced_at' => now(),
        ], fn ($value) => $value !== null))->save();

        $this->log($mailbox, 'update_mailbox', 'completed', 'Mailbox updated in ISPConfig.');
    }

    private function setReceivingEnabled(IspConfigClient $client, string $sessionId, MailboxRecord $mailbox, int $ispConfigClientId, bool $enabled): void
    {
        $client->mailUserUpdate($sessionId, $ispConfigClientId, (int) $mailbox->ispconfig_mailbox_id, [
            'postfix' => $enabled ? 'y' : 'n',
        ]);

        $mailbox->forceFill(['status' => $enabled ? 'active' : 'suspended', 'last_synced_at' => now()])->save();

        $this->log($mailbox, $enabled ? 'resume_mailbox' : 'suspend_mailbox', 'completed', $enabled ? 'Mailbox resumed in ISPConfig.' : 'Mailbox suspended in ISPConfig.');
    }

    private function delete(IspConfigClient $client, string $sessionId, MailboxRecord $mailbox): void
    {
        $client->mailUserDelete($sessionId, (int) $mailbox->ispconfig_mailbox_id);

        $mailbox->forceFill(['status' => 'deleted', 'last_synced_at' => now()])->save();
        $mailbox->delete();

        $this->log($mailbox, 'delete_mailbox', 'completed', 'Mailbox deleted from ISPConfig.');

        SyncHostingUsageSnapshotJob::dispatch($mailbox->hosting_service_id, 'resource_change');
    }

    private function fail(MailboxRecord $mailbox, string $message, array $context = []): void
    {
        $mailbox->forceFill(['status' => 'failed'])->save();

        ProvisioningLog::query()->create([
            'client_id' => $mailbox->hostingService?->client_id,
            'hosting_service_id' => $mailbox->hosting_service_id,
            'provider' => 'ispconfig',
            'action' => $this->action.'_mailbox',
            'status' => 'failed',
            'message' => $message,
            'response_payload' => $context ?: null,
            'finished_at' => now(),
        ]);
    }

    private function log(MailboxRecord $mailbox, string $action, string $status, string $message): void
    {
        ProvisioningLog::query()->create([
            'client_id' => $mailbox->hostingService?->client_id,
            'hosting_service_id' => $mailbox->hosting_service_id,
            'provider' => 'ispconfig',
            'action' => $action,
            'status' => $status,
            'message' => $message,
            'finished_at' => now(),
        ]);
    }
}
