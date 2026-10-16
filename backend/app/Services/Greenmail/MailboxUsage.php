<?php

namespace App\Services\Greenmail;

use App\Models\MailboxRecord;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Support\Facades\Cache;

/**
 * Storage used by one mailbox, for the Greenmail storage meter when Dovecot
 * doesn't report an IMAP quota (this server doesn't). The limit is the
 * mailbox's own quota (0 = shares the package's space); usage comes from
 * ISPConfig, cached for ten minutes.
 */
class MailboxUsage
{
    public function __construct(private readonly IspConfigClient $ispConfig)
    {
    }

    /** @return array{used_bytes: int, limit_bytes: int}|null */
    public function forMailbox(string $email): ?array
    {
        $mailbox = MailboxRecord::query()->whereRaw('LOWER(email_address) = ?', [strtolower($email)])->with('hostingService.ispConfigServiceMappings.clientMapping')->first();
        $clientId = (int) $mailbox?->hostingService?->ispConfigServiceMappings->first()?->clientMapping?->ispconfig_client_id;

        if (! $mailbox || ! $clientId) {
            return null;
        }

        $used = Cache::remember("greenmail:usage:{$mailbox->id}", 600, function () use ($clientId, $email) {
            $sessionId = $this->ispConfig->login();

            try {
                $row = collect($this->ispConfig->mailQuotaGetByUser($sessionId, $clientId))
                    ->first(fn (array $row) => strtolower((string) ($row['email'] ?? '')) === strtolower($email));
            } finally {
                $this->ispConfig->logout($sessionId);
            }

            return (int) ($row['used_raw'] ?? 0);
        });

        $limit = $mailbox->quota_mb > 0
            ? $mailbox->quota_mb * 1048576
            // Unlimited mailbox: measure against the package's whole storage.
            : (int) (($mailbox->hostingService->latestUsageSnapshot()?->disk_quota_mb ?? 0) * 1048576);

        return $limit > 0 ? ['used_bytes' => $used, 'limit_bytes' => $limit] : null;
    }
}
