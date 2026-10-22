<?php

namespace App\Services\Greenmail;

use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use App\Services\Greenmail\Exceptions\MailServerUnavailable;

/**
 * One signed-in mailbox on the mail server (IMAP). The real implementation
 * talks to Dovecot; tests use FakeMailGateway.
 *
 * Message summary shape:
 *   {uid, subject, from: {name, email}, to: [{name, email}], date, seen, flagged, answered, has_attachments, snippet, labels: string[]}
 */
interface MailGateway
{
    /**
     * @throws MailAuthenticationFailed wrong email/password
     * @throws MailServerUnavailable mail server unreachable
     */
    public function open(string $email, string $password): void;

    public function close(): void;

    /** @return array<int, array{path: string, name: string, role: ?string, unread: int, total: int}> */
    public function folders(): array;

    /**
     * @param  string  $filter  all | unread | flagged | attachments | label:<key> (see Labels)
     * @return array{messages: array<int, array<string, mixed>>, total: int}
     */
    public function messages(string $folder, int $page, int $perPage, string $filter = 'all', ?string $search = null): array;

    /**
     * Full message: summary fields plus cc, reply_to, message_id, references,
     * html (raw, unsanitised), text, attachments [{index, name, size, mime, content_id, inline}].
     */
    public function message(string $folder, int $uid, bool $markSeen = true): ?array;

    /** @return array{name: string, mime: string, content: string}|null */
    public function attachment(string $folder, int $uid, int $index): ?array;

    public function setFlags(string $folder, int $uid, ?bool $seen = null, ?bool $flagged = null): void;

    public function move(string $folder, int $uid, string $toFolder): void;

    /** Removes the message for good (callers move to Trash first when that's wanted). */
    public function delete(string $folder, int $uid): void;

    /** Removes every message in the folder for good; returns how many. */
    public function emptyFolder(string $path): int;

    /** How many messages in the folder are starred (flagged). */
    public function countFlagged(string $path): int;

    /** Creates the folder if it doesn't exist yet (e.g. "Archive"). */
    public function ensureFolder(string $path): void;

    /** Stores a complete RFC 822 message (e.g. a sent copy or a draft). */
    public function append(string $folder, string $rawMessage, array $flags = []): void;

    /** @return array{used_bytes: int, limit_bytes: int}|null  null when the mailbox has no quota */
    public function quota(): ?array;

    /** Adds / removes business labels (Labels keys) on an email. */
    public function setLabels(string $folder, int $uid, array $add = [], array $remove = []): void;

    /** The UID of the email with this Message-ID in the folder, if it is there. */
    public function findUidByMessageId(string $folder, string $messageId): ?int;

    /** Whether the folder holds a reply to this Message-ID (In-Reply-To or References). */
    public function hasReplyTo(string $folder, string $messageId): bool;

    /**
     * Emails with attachments, for the attachment index, $limit at a time:
     * - $belowUid given: the newest ones below it (filling in older mail);
     * - $aboveUid given (0 too): the OLDEST ones above it (new mail, so none are skipped);
     * - neither: the newest in the folder (first scan).
     *
     * @return array<int, array{uid: int, message_id: string, subject: string, from: array, date: ?string, attachments: array<int, array{index: int, name: string, size: int, mime: string}>}>
     */
    public function messagesWithAttachments(string $folder, ?int $aboveUid, ?int $belowUid, int $limit): array;
}
