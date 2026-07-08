<?php

namespace App\Jobs;

use App\Models\MailboxRecord;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncMailboxesJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly ?int $hostingServiceId = null)
    {
    }

    public function handle(IspConfigClient $client): void
    {
        $query = MailboxRecord::query()->whereNotNull('ispconfig_mailbox_id');

        if ($this->hostingServiceId) {
            $query->where('hosting_service_id', $this->hostingServiceId);
        }

        if (! $query->exists()) {
            return;
        }

        $sessionId = $client->login();

        try {
            $query->chunkById(100, function ($mailboxes) use ($client, $sessionId): void {
                foreach ($mailboxes as $mailbox) {
                    try {
                        $remote = $client->mailUserGet($sessionId, (int) $mailbox->ispconfig_mailbox_id);

                        if ($remote === null) {
                            $mailbox->forceFill(['status' => 'missing_remote', 'last_synced_at' => now()])->save();

                            ProvisioningLog::query()->create([
                                'hosting_service_id' => $mailbox->hosting_service_id,
                                'provider' => 'ispconfig',
                                'action' => 'sync_mailbox',
                                'status' => 'review_required',
                                'message' => "Mailbox {$mailbox->email_address} no longer exists in ISPConfig.",
                                'finished_at' => now(),
                            ]);

                            continue;
                        }

                        $mailbox->forceFill([
                            'status' => ($remote['postfix'] ?? 'y') === 'y' ? 'active' : 'disabled',
                            'quota_mb' => isset($remote['quota']) ? (int) $remote['quota'] : $mailbox->quota_mb,
                            'last_synced_at' => now(),
                        ])->save();
                    } catch (IspConfigApiException $exception) {
                        ProvisioningLog::query()->create([
                            'hosting_service_id' => $mailbox->hosting_service_id,
                            'provider' => 'ispconfig',
                            'action' => 'sync_mailbox',
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
