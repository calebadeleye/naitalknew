<?php

namespace App\Services\Greenmail;

use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use Illuminate\Support\Str;

/**
 * In-memory mailbox for tests. Register accounts with addAccount(), seed mail
 * with deliver(); everything the app does is visible in $mailboxes / $sentRaw.
 */
class FakeMailGateway implements MailGateway
{
    /** @var array<string, string> email => password */
    public array $accounts = [];

    /** @var array<string, array<string, array<int, array<string, mixed>>>> email => folder => uid => message */
    public array $mailboxes = [];

    public ?array $quotaFor = null;

    /** @var array<int, array{folder: string, raw: string, flags: array}> */
    public array $appended = [];

    private ?string $email = null;

    private int $nextUid = 100;

    public function addAccount(string $email, string $password): void
    {
        $this->accounts[strtolower($email)] = $password;
        $this->mailboxes[strtolower($email)] ??= ['INBOX' => [], 'Sent' => [], 'Drafts' => [], 'Junk' => [], 'Trash' => []];
    }

    /** @param  array<string, mixed>  $message  subject, from, html/text, attachments [{name, mime, content}] … */
    public function deliver(string $email, array $message, string $folder = 'INBOX'): int
    {
        $uid = $this->nextUid++;
        $this->mailboxes[strtolower($email)][$folder][$uid] = $message + [
            'uid' => $uid,
            'subject' => '(no subject)',
            'from' => ['name' => null, 'email' => 'someone@example.test'],
            'to' => [['name' => null, 'email' => strtolower($email)]],
            'cc' => [],
            'reply_to' => [],
            'date' => now()->toIso8601String(),
            'seen' => false,
            'flagged' => false,
            'answered' => false,
            'message_id' => '<'.Str::uuid().'@example.test>',
            'references' => '',
            'in_reply_to' => '',
            'labels' => [],
            'html' => null,
            'text' => '',
            'attachments' => [],
        ];

        return $uid;
    }

    public function open(string $email, string $password): void
    {
        if (($this->accounts[strtolower($email)] ?? null) !== $password) {
            throw new MailAuthenticationFailed('Wrong email address or password.');
        }

        $this->email = strtolower($email);
    }

    public function close(): void
    {
        $this->email = null;
    }

    public function folders(): array
    {
        return collect($this->box())->map(fn (array $messages, string $path) => [
            'path' => $path,
            'name' => $path === 'INBOX' ? 'Inbox' : $path,
            'role' => FolderRoles::detect($path),
            'unread' => collect($messages)->where('seen', false)->count(),
            'total' => count($messages),
        ])->values()->all();
    }

    public function messages(string $folder, int $page, int $perPage, string $filter = 'all', ?string $search = null): array
    {
        $messages = collect($this->box()[$folder] ?? [])
            ->when($filter === 'unread', fn ($c) => $c->where('seen', false))
            ->when($filter === 'flagged', fn ($c) => $c->where('flagged', true))
            ->when($filter === 'attachments', fn ($c) => $c->filter(fn ($m) => $m['attachments'] !== []))
            ->when(str_starts_with($filter, 'label:'), fn ($c) => $c->filter(fn ($m) => in_array(substr($filter, 6), $m['labels'] ?? [], true)))
            ->when($search, fn ($c) => $c->filter(fn ($m) => Str::contains(strtolower($m['subject'].' '.$m['text'].' '.$m['from']['email']), strtolower((string) $search))))
            ->sortByDesc('uid');

        return [
            'messages' => $messages->forPage($page, $perPage)->map(fn ($m) => $this->summary($m))->values()->all(),
            'total' => $messages->count(),
        ];
    }

    public function message(string $folder, int $uid, bool $markSeen = true): ?array
    {
        $message = $this->box()[$folder][$uid] ?? null;

        if (! $message) {
            return null;
        }

        if ($markSeen) {
            $this->mailboxes[$this->email][$folder][$uid]['seen'] = $message['seen'] = true;
        }

        return $this->summary($message) + [
            'cc' => $message['cc'],
            'reply_to' => $message['reply_to'],
            'message_id' => $message['message_id'],
            'references' => $message['references'],
            'html' => $message['html'],
            'text' => $message['text'],
            'attachments' => collect($message['attachments'])->values()->map(fn ($a, $i) => [
                'index' => $i, 'name' => $a['name'], 'size' => strlen($a['content']), 'mime' => $a['mime'],
                'content_id' => $a['content_id'] ?? null, 'inline' => (bool) ($a['inline'] ?? false),
            ])->all(),
        ];
    }

    public function attachment(string $folder, int $uid, int $index): ?array
    {
        $attachment = $this->box()[$folder][$uid]['attachments'][$index] ?? null;

        return $attachment ? ['name' => $attachment['name'], 'mime' => $attachment['mime'], 'content' => $attachment['content']] : null;
    }

    public function setFlags(string $folder, int $uid, ?bool $seen = null, ?bool $flagged = null): void
    {
        if (! isset($this->box()[$folder][$uid])) {
            return;
        }
        if ($seen !== null) {
            $this->mailboxes[$this->email][$folder][$uid]['seen'] = $seen;
        }
        if ($flagged !== null) {
            $this->mailboxes[$this->email][$folder][$uid]['flagged'] = $flagged;
        }
    }

    public function move(string $folder, int $uid, string $toFolder): void
    {
        $message = $this->box()[$folder][$uid] ?? null;
        if ($message) {
            unset($this->mailboxes[$this->email][$folder][$uid]);
            $this->mailboxes[$this->email][$toFolder][$uid] = $message;
        }
    }

    public function delete(string $folder, int $uid): void
    {
        unset($this->mailboxes[$this->email][$folder][$uid]);
    }

    public function emptyFolder(string $path): int
    {
        $count = count($this->box()[$path] ?? []);
        $this->mailboxes[$this->email][$path] = [];

        return $count;
    }

    public function countFlagged(string $path): int
    {
        return collect($this->box()[$path] ?? [])->where('flagged', true)->count();
    }

    public function ensureFolder(string $path): void
    {
        $this->mailboxes[$this->email][$path] ??= [];
    }

    public function append(string $folder, string $rawMessage, array $flags = []): void
    {
        $this->appended[] = ['folder' => $folder, 'raw' => $rawMessage, 'flags' => $flags];
        preg_match('/^Subject: (.*)$/mi', $rawMessage, $subject);
        preg_match('/^Message-ID:\s*(<[^>\r\n]+>)/mi', $rawMessage, $id);
        $this->deliver($this->email, array_filter(['subject' => trim($subject[1] ?? ''), 'seen' => true, 'text' => $rawMessage, 'message_id' => $id[1] ?? null]), $folder);
    }

    public function quota(): ?array
    {
        return $this->quotaFor;
    }

    public function setLabels(string $folder, int $uid, array $add = [], array $remove = []): void
    {
        if (! isset($this->box()[$folder][$uid])) {
            return;
        }
        $labels = $this->mailboxes[$this->email][$folder][$uid]['labels'] ?? [];
        $labels = array_values(array_diff(array_unique(array_merge($labels, array_filter($add, fn ($k) => Labels::keyword($k) !== null))), $remove));
        $this->mailboxes[$this->email][$folder][$uid]['labels'] = $labels;
    }

    public function findUidByMessageId(string $folder, string $messageId): ?int
    {
        foreach ($this->box()[$folder] ?? [] as $uid => $message) {
            if (($message['message_id'] ?? null) === $messageId) {
                return (int) $uid;
            }
        }

        return null;
    }

    public function hasReplyTo(string $folder, string $messageId): bool
    {
        return collect($this->box()[$folder] ?? [])->contains(fn ($m) => ($m['in_reply_to'] ?? '') === $messageId || str_contains((string) ($m['references'] ?? ''), $messageId));
    }

    public function messagesWithAttachments(string $folder, ?int $aboveUid, ?int $belowUid, int $limit): array
    {
        return collect($this->box()[$folder] ?? [])
            ->filter(fn ($m) => $m['attachments'] !== [])
            ->filter(fn ($m) => $belowUid !== null ? $m['uid'] < $belowUid : $m['uid'] > ($aboveUid ?? 0))
            ->sortBy('uid', descending: ! ($belowUid === null && $aboveUid !== null))
            ->take($limit)
            ->map(fn ($m) => [
                'uid' => $m['uid'], 'message_id' => $m['message_id'], 'subject' => $m['subject'], 'from' => $m['from'], 'date' => $m['date'],
                'attachments' => collect($m['attachments'])->values()->map(fn ($a, $i) => ['index' => $i, 'name' => $a['name'], 'size' => strlen($a['content']), 'mime' => $a['mime']])->all(),
            ])
            ->values()
            ->all();
    }

    private function box(): array
    {
        return $this->mailboxes[$this->email] ?? [];
    }

    private function summary(array $m): array
    {
        return [
            'uid' => $m['uid'], 'subject' => $m['subject'], 'from' => $m['from'], 'to' => $m['to'], 'date' => $m['date'],
            'seen' => $m['seen'], 'flagged' => $m['flagged'], 'answered' => $m['answered'],
            'has_attachments' => $m['attachments'] !== [], 'snippet' => Str::limit(strip_tags((string) ($m['text'] ?: $m['html'])), 140),
            'labels' => array_values($m['labels'] ?? []),
        ];
    }
}
