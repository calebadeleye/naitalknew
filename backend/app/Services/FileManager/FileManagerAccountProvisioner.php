<?php

namespace App\Services\FileManager;

use App\Models\HostingFileManagerAccount;
use App\Models\HostingService;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Support\Str;

/**
 * Provisions the hidden ISPConfig shell account each hosting service's File
 * Manager runs on. Reuses the same "shell user chrooted to the website's own
 * document root" mechanism as client-created SSH/SFTP accounts (see
 * FtpAccountProvisioningActionJob) — the client just never sees this one's
 * credentials.
 */
class FileManagerAccountProvisioner
{
    public function __construct(private readonly IspConfigClient $ispConfig) {}

    /**
     * @return array{account: HostingFileManagerAccount, just_created: bool}
     */
    public function ensure(HostingService $service): array
    {
        $existing = HostingFileManagerAccount::query()->where('hosting_service_id', $service->id)->first();

        if ($existing && $existing->status === 'active') {
            return ['account' => $existing, 'just_created' => false];
        }

        $mapping = $service->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first();

        if (! $mapping?->ispconfig_website_id || ! $mapping->clientMapping?->ispconfig_client_id) {
            throw new IspConfigApiException('This service is not provisioned in ISPConfig yet.', ['hosting_service_id' => $service->id]);
        }

        $username = $existing?->username ?? 'fm-'.$service->id.'-'.Str::lower(Str::random(6));
        $password = Str::random(32);

        $sessionId = $this->ispConfig->login();

        try {
            $website = $this->ispConfig->sitesWebDomainGet($sessionId, (int) $mapping->ispconfig_website_id);

            if (! $website) {
                throw new IspConfigApiException('Website record not found while setting up the file manager.', ['hosting_service_id' => $service->id]);
            }

            $remoteId = $this->ispConfig->shellUserAdd($sessionId, (int) $mapping->clientMapping->ispconfig_client_id, [
                'username' => $username,
                'password' => $password,
                'parent_domain_id' => (int) $mapping->ispconfig_website_id,
                'server_id' => $website['server_id'],
                'puser' => $website['system_user'],
                'pgroup' => $website['system_group'],
                'dir' => $website['document_root'],
                'quota_size' => -1,
                'active' => 'y',
                'shell' => config('ispconfig.ssh_shell', '/bin/bash'),
                'chroot' => config('ispconfig.ssh_chroot', 'jailkit'),
            ]);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        $account = HostingFileManagerAccount::query()->updateOrCreate(
            ['hosting_service_id' => $service->id],
            [
                'ispconfig_shell_user_id' => (string) $remoteId,
                'username' => $username,
                'password' => $password,
                'status' => 'active',
                'last_synced_at' => now(),
            ],
        );

        return ['account' => $account, 'just_created' => true];
    }
}
