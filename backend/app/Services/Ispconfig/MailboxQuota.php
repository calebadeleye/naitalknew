<?php

namespace App\Services\Ispconfig;

/**
 * ISPConfig keeps mail_user.quota in BYTES (0 = unlimited); our
 * mailbox_records.quota_mb is megabytes. Every value crossing between the two
 * goes through here — mixing them up once stored 5,242,880,000 "MB" (and sent
 * a 1,000 MB mailbox to ISPConfig as 1,000 bytes).
 */
final class MailboxQuota
{
    private const BYTES_PER_MB = 1_048_576;

    /** ISPConfig quota (bytes) → our megabytes; 0 stays "unlimited". */
    public static function toMb(mixed $bytes): int
    {
        $bytes = (int) $bytes;

        return $bytes > 0 ? (int) round($bytes / self::BYTES_PER_MB) : 0;
    }

    /** Our megabytes → ISPConfig quota (bytes); 0 stays "unlimited". */
    public static function toBytes(?int $megabytes): int
    {
        return $megabytes !== null && $megabytes > 0 ? $megabytes * self::BYTES_PER_MB : 0;
    }
}
