<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailAttachment;
use App\Models\Greenmail\GreenmailAttachmentScan;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Throwable;

/**
 * The attachment manager's index: every file attached to the mailbox's mail,
 * so people can browse PDFs, images, documents and spreadsheets without
 * digging through old emails.
 *
 * Built a batch at a time while the manager is open (new mail first, then
 * older mail), within a time budget per request so the page stays quick; the
 * app keeps asking while `pending` is true.
 */
class AttachmentIndex
{
    private const BATCH = 25;

    private const TIME_BUDGET_SECONDS = 6;

    private const SKIPPED_ROLES = ['trash', 'junk', 'drafts'];

    private const KINDS = [
        'pdf' => ['pdf'],
        'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'svg'],
        'document' => ['doc', 'docx', 'docm', 'odt', 'rtf', 'txt', 'pages'],
        'spreadsheet' => ['xls', 'xlsx', 'xlsm', 'xlsb', 'ods', 'csv', 'numbers'],
        'presentation' => ['ppt', 'pptx', 'pptm', 'ppsm', 'odp', 'key'],
        'archive' => ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'],
    ];

    /** Files that run code when opened — the usual way malware arrives by email. */
    private const DANGEROUS = ['exe', 'scr', 'pif', 'com', 'bat', 'cmd', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'msi', 'msp', 'jar', 'ps1', 'psm1', 'hta', 'cpl', 'lnk', 'reg', 'apk', 'app', 'dmg', 'iso', 'img', 'vhd', 'vhdx', 'xll', 'scf', 'gadget', 'chm', 'sh'];

    /** Office files that can carry macros. */
    private const MACROS = ['docm', 'dotm', 'xlsm', 'xltm', 'xlsb', 'pptm', 'potm', 'ppsm'];

    /** Types the browser can show safely (never HTML or SVG, which could run script). */
    public const PREVIEWABLE_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'text/plain', 'text/csv'];

    /** @return array{kind: string, extension: ?string, warning: ?string} */
    public static function classify(string $name, ?string $mime): array
    {
        $lower = Str::lower(trim($name));
        $extension = str_contains($lower, '.') ? Str::afterLast($lower, '.') : null;
        $kind = 'other';
        foreach (self::KINDS as $candidate => $extensions) {
            if ($extension !== null && in_array($extension, $extensions, true)) {
                $kind = $candidate;
                break;
            }
        }

        $mime = Str::lower((string) $mime);
        $parts = explode('.', $lower);
        $innerExtension = count($parts) > 2 ? $parts[count($parts) - 2] : null;

        $warning = match (true) {
            $extension !== null && in_array($extension, self::DANGEROUS, true) && $innerExtension && in_array($innerExtension, array_merge(...array_values(self::KINDS)), true) => 'This file pretends to be a '.Str::upper($innerExtension).' but is a program. Don’t open it.',
            $extension !== null && in_array($extension, self::DANGEROUS, true) => 'This is a program or script, which can harm your computer. Open it only if you were expecting it from someone you trust.',
            $extension !== null && in_array($extension, self::MACROS, true) => 'This Office file can contain macros. Don’t enable editing or macros unless you trust the sender.',
            $kind === 'pdf' && $mime !== '' && ! in_array($mime, ['application/pdf', 'application/octet-stream', 'application/x-pdf'], true) => 'This file is named like a PDF but is a different kind of file.',
            $kind === 'archive' => 'Compressed files can hide programs. Open it only if you were expecting it.',
            default => null,
        };

        return ['kind' => $kind, 'extension' => $extension, 'warning' => $warning];
    }

    /**
     * Index the next batch of mail.
     *
     * @return array{pending: bool, indexed: int}
     */
    public function sync(string $owner, MailGateway $mail): array
    {
        $started = microtime(true);
        $indexed = 0;
        $pending = false;

        $folders = collect($mail->folders())
            ->reject(fn (array $folder) => in_array($folder['role'], self::SKIPPED_ROLES, true) || $folder['path'] === FollowUps::SNOOZED_FOLDER)
            ->sortBy(fn (array $folder) => $folder['role'] === 'inbox' ? 0 : ($folder['role'] === 'sent' ? 1 : 2))
            ->values();

        foreach ($folders as $folder) {
            if (microtime(true) - $started > self::TIME_BUDGET_SECONDS) {
                $pending = true;
                break;
            }

            $scan = GreenmailAttachmentScan::query()->firstOrCreate(['owner_email' => $owner, 'folder' => $folder['path']]);

            // New mail since the last visit (oldest first, so nothing is skipped).
            // A folder that was empty on its first scan is complete with highest 0.
            if ($scan->highest_uid > 0 || $scan->complete) {
                $new = $mail->messagesWithAttachments($folder['path'], $scan->highest_uid, null, self::BATCH);
                $indexed += $this->store($owner, $folder['path'], $new);
                if ($new !== []) {
                    $scan->highest_uid = max(array_column($new, 'uid'));
                }
                if (count($new) === self::BATCH) {
                    $pending = true;
                }
            }

            // Older mail, a batch at a time, until the whole folder is done.
            if (! $scan->complete && microtime(true) - $started <= self::TIME_BUDGET_SECONDS) {
                $older = $mail->messagesWithAttachments($folder['path'], null, $scan->lowest_uid, self::BATCH);
                $indexed += $this->store($owner, $folder['path'], $older);
                if ($older !== []) {
                    $uids = array_column($older, 'uid');
                    $scan->lowest_uid = min($uids);
                    $scan->highest_uid = max($scan->highest_uid, max($uids));
                }
                $scan->complete = count($older) < self::BATCH;
            }

            $pending = $pending || ! $scan->complete;
            $scan->save();
        }

        return ['pending' => $pending, 'indexed' => $indexed];
    }

    /** An entry whose email is gone (moved, deleted) is dropped when it's opened. */
    public function forget(string $owner, string $folder, int $uid): void
    {
        GreenmailAttachment::query()->where('owner_email', $owner)->where('folder', $folder)->where('uid', $uid)->delete();
    }

    /** Start over (e.g. after mail was reorganised in another app). */
    public function reset(string $owner): void
    {
        GreenmailAttachment::query()->where('owner_email', $owner)->delete();
        GreenmailAttachmentScan::query()->where('owner_email', $owner)->delete();
    }

    private function store(string $owner, string $folder, array $messages): int
    {
        $count = 0;

        foreach ($messages as $message) {
            // One odd email must not stop the rest of the mailbox being indexed.
            try {
                $count += $this->storeMessage($owner, $folder, $message);
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $count;
    }

    private function storeMessage(string $owner, string $folder, array $message): int
    {
        $count = 0;
        // No Date header comes back as 1970, which isn't a real date (and MySQL refuses it).
        $sentAt = rescue(fn () => $message['date'] ? Carbon::parse($message['date'])->utc() : null, null, report: false);
        $sentAt = $sentAt && $sentAt->year >= 1980 ? $sentAt : null;

        foreach ($message['attachments'] as $attachment) {
            $class = self::classify($attachment['name'], $attachment['mime']);
            GreenmailAttachment::query()->updateOrCreate(
                ['owner_email' => $owner, 'folder' => $folder, 'uid' => $message['uid'], 'part_index' => $attachment['index']],
                [
                    'message_id' => Str::limit((string) $message['message_id'], 495, ''),
                    'name' => Str::limit($attachment['name'], 250, ''),
                    'extension' => $class['extension'] ? Str::limit($class['extension'], 20, '') : null,
                    'kind' => $class['kind'],
                    'mime' => Str::limit($attachment['mime'], 150, ''),
                    'size' => $attachment['size'],
                    'from_name' => Str::limit((string) ($message['from']['name'] ?? ''), 250, '') ?: null,
                    'from_email' => $message['from']['email'] ?? null,
                    'subject' => Str::limit((string) $message['subject'], 250, ''),
                    'sent_at' => $sentAt,
                    'warning' => $class['warning'],
                ],
            );
            $count++;
        }

        return $count;
    }
}
