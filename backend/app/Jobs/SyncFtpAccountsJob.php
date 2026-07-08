<?php

namespace App\Jobs;

use App\Models\FtpAccountRecord;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncFtpAccountsJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ?int $hostingServiceId = null)
    {
    }

    public function handle(IspConfigClient $client): void
    {
        $query = FtpAccountRecord::query()->whereNotNull('ispconfig_ftp_user_id');

        if ($this->hostingServiceId) {
            $query->where('hosting_service_id', $this->hostingServiceId);
        }

        if (! $query->exists()) {
            return;
        }

        $sessionId = $client->login();

        try {
            $query->chunkById(100, function ($accounts) use ($client, $sessionId): void {
                foreach ($accounts as $account) {
                    try {
                        $remote = $client->ftpUserGet($sessionId, (int) $account->ispconfig_ftp_user_id);

                        if ($remote === null) {
                            $account->forceFill(['status' => 'missing_remote', 'last_synced_at' => now()])->save();

                            ProvisioningLog::query()->create([
                                'hosting_service_id' => $account->hosting_service_id,
                                'provider' => 'ispconfig',
                                'action' => 'sync_ftp_account',
                                'status' => 'review_required',
                                'message' => "FTP account {$account->username} no longer exists in ISPConfig.",
                                'finished_at' => now(),
                            ]);

                            continue;
                        }

                        $account->forceFill([
                            'status' => ($remote['active'] ?? 'y') === 'y' ? 'active' : 'disabled',
                            'last_synced_at' => now(),
                        ])->save();
                    } catch (IspConfigApiException $exception) {
                        ProvisioningLog::query()->create([
                            'hosting_service_id' => $account->hosting_service_id,
                            'provider' => 'ispconfig',
                            'action' => 'sync_ftp_account',
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
