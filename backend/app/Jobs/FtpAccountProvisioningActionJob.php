<?php

namespace App\Jobs;

use App\Models\FtpAccountRecord;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class FtpAccountProvisioningActionJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [15, 60, 180];

    public function __construct(
        public readonly int $ftpAccountRecordId,
        public readonly string $action,
        public readonly array $payload = [],
    ) {
    }

    public function handle(IspConfigClient $client): void
    {
        $ftpAccount = FtpAccountRecord::query()->find($this->ftpAccountRecordId);

        if (! $ftpAccount) {
            return;
        }

        $service = $ftpAccount->hostingService;
        $serviceMapping = $service->ispConfigServiceMappings()->first();

        if (! $serviceMapping || ! $serviceMapping->clientMapping?->ispconfig_client_id) {
            $this->fail($ftpAccount, 'Hosting service has no ISPConfig client mapping yet.');

            return;
        }

        $ispConfigClientId = (int) $serviceMapping->clientMapping->ispconfig_client_id;
        $sessionId = $client->login();

        try {
            match ($this->action) {
                'create' => $this->create($client, $sessionId, $ftpAccount, $ispConfigClientId, (int) $serviceMapping->ispconfig_website_id),
                'reset_password' => $this->resetPassword($client, $sessionId, $ftpAccount, $ispConfigClientId),
                'disable' => $this->disable($client, $sessionId, $ftpAccount, $ispConfigClientId),
                'delete' => $this->delete($client, $sessionId, $ftpAccount),
                default => throw new IspConfigApiException("Unknown FTP account action: {$this->action}"),
            };
        } catch (IspConfigApiException $exception) {
            $this->fail($ftpAccount, $exception->safeMessage(), $exception->context());
        } finally {
            $client->logout($sessionId);
        }
    }

    private function create(IspConfigClient $client, string $sessionId, FtpAccountRecord $ftpAccount, int $ispConfigClientId, int $websiteId): void
    {
        // FTP accounts in ISPConfig are attached to the website's own Linux
        // user/group and confined to its document root — these aren't
        // package-level settings, they're read from the website record.
        $website = $client->sitesWebDomainGet($sessionId, $websiteId);

        if (! $website) {
            throw new IspConfigApiException('Website record not found while creating FTP account.');
        }

        $remoteId = $client->ftpUserAdd($sessionId, $ispConfigClientId, [
            'username' => $ftpAccount->username,
            'password' => $this->payload['password'] ?? null,
            'parent_domain_id' => $websiteId,
            // Unlike mail users (which inherit their server from the mail
            // domain), ISPConfig's FTP user API requires server_id directly —
            // without it the account is never attached to a real server and
            // login fails.
            'server_id' => $website['server_id'],
            // ISPConfig validates these against the website's actual system
            // user/group names, not the numeric sys_userid/sys_groupid.
            'uid' => $website['system_user'],
            'gid' => $website['system_group'],
            'dir' => $website['document_root'],
            'quota_size' => -1,
            'active' => 'y',
        ]);

        $ftpAccount->forceFill([
            'ispconfig_ftp_user_id' => (string) $remoteId,
            'status' => 'active',
            'last_synced_at' => now(),
        ])->save();

        $this->log($ftpAccount, 'create_ftp_account', 'completed', 'FTP account created in ISPConfig.');

        SyncHostingUsageSnapshotJob::dispatch($ftpAccount->hosting_service_id, 'resource_change');
    }

    private function resetPassword(IspConfigClient $client, string $sessionId, FtpAccountRecord $ftpAccount, int $ispConfigClientId): void
    {
        $client->ftpUserUpdate($sessionId, $ispConfigClientId, (int) $ftpAccount->ispconfig_ftp_user_id, [
            'password' => $this->payload['password'] ?? null,
        ]);

        $ftpAccount->forceFill(['last_synced_at' => now()])->save();

        $this->log($ftpAccount, 'reset_ftp_password', 'completed', 'FTP account password reset in ISPConfig.');
    }

    private function disable(IspConfigClient $client, string $sessionId, FtpAccountRecord $ftpAccount, int $ispConfigClientId): void
    {
        $client->ftpUserUpdate($sessionId, $ispConfigClientId, (int) $ftpAccount->ispconfig_ftp_user_id, ['active' => 'n']);

        $ftpAccount->forceFill(['status' => 'disabled', 'last_synced_at' => now()])->save();

        $this->log($ftpAccount, 'disable_ftp_account', 'completed', 'FTP account disabled in ISPConfig.');
    }

    private function delete(IspConfigClient $client, string $sessionId, FtpAccountRecord $ftpAccount): void
    {
        $client->ftpUserDelete($sessionId, (int) $ftpAccount->ispconfig_ftp_user_id);

        $ftpAccount->forceFill(['status' => 'deleted', 'last_synced_at' => now()])->save();
        $ftpAccount->delete();

        $this->log($ftpAccount, 'delete_ftp_account', 'completed', 'FTP account deleted from ISPConfig.');

        SyncHostingUsageSnapshotJob::dispatch($ftpAccount->hosting_service_id, 'resource_change');
    }

    private function fail(FtpAccountRecord $ftpAccount, string $message, array $context = []): void
    {
        $ftpAccount->forceFill(['status' => 'failed'])->save();

        ProvisioningLog::query()->create([
            'client_id' => $ftpAccount->hostingService?->client_id,
            'hosting_service_id' => $ftpAccount->hosting_service_id,
            'provider' => 'ispconfig',
            'action' => $this->action.'_ftp_account',
            'status' => 'failed',
            'message' => $message,
            'response_payload' => $context ?: null,
            'finished_at' => now(),
        ]);
    }

    private function log(FtpAccountRecord $ftpAccount, string $action, string $status, string $message): void
    {
        ProvisioningLog::query()->create([
            'client_id' => $ftpAccount->hostingService?->client_id,
            'hosting_service_id' => $ftpAccount->hosting_service_id,
            'provider' => 'ispconfig',
            'action' => $action,
            'status' => $status,
            'message' => $message,
            'finished_at' => now(),
        ]);
    }
}
