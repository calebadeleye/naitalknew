<?php

namespace App\Services\Greenmail;

use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use App\Services\Greenmail\Exceptions\MailServerUnavailable;
use Illuminate\Support\Str;
use Throwable;
use Webklex\PHPIMAP\Address;
use Webklex\PHPIMAP\Client;
use Webklex\PHPIMAP\ClientManager;
use Webklex\PHPIMAP\Exceptions\AuthFailedException;
use Webklex\PHPIMAP\Folder;
use Webklex\PHPIMAP\IMAP;
use Webklex\PHPIMAP\Message;

/** MailGateway over IMAP (Dovecot) using webklex/php-imap — no PHP imap extension needed. */
class WebklexMailGateway implements MailGateway
{
    private ?Client $client = null;

    public function open(string $email, string $password): void
    {
        $config = config('greenmail.imap');

        $manager = new ClientManager([
            'options' => [
                'fetch' => IMAP::FT_PEEK,
                'fetch_order' => 'desc',
                'soft_fail' => true,
                'rfc822' => true,
                'debug' => false,
            ],
            // webklex drops flags it doesn't know; keep the business labels (IMAP keywords).
            'flags' => array_merge(['recent', 'flagged', 'answered', 'deleted', 'seen', 'draft'], Labels::imapFlagNames()),
        ]);

        $this->client = $manager->make([
            'host' => $config['host'],
            'port' => $config['port'],
            'encryption' => $config['encryption'],
            'validate_cert' => $config['validate_cert'],
            'protocol' => 'imap',
            'username' => $email,
            'password' => $password,
            'timeout' => $config['timeout'],
        ]);

        try {
            $this->client->connect();
        } catch (AuthFailedException $exception) {
            throw new MailAuthenticationFailed('Wrong email address or password.', 0, $exception);
        } catch (Throwable $exception) {
            // Dovecot refuses a bad login with "NO [AUTHENTICATIONFAILED] …", which
            // webklex surfaces as a server error (or a failed connection) — so tell
            // a wrong password apart from an unreachable server by its wording.
            if ($this->isRefusedLogin($exception)) {
                throw new MailAuthenticationFailed('Wrong email address or password.', 0, $exception);
            }

            throw new MailServerUnavailable('The mail server could not be reached.', 0, $exception);
        }
    }

    private function isRefusedLogin(Throwable $exception): bool
    {
        for ($current = $exception; $current; $current = $current->getPrevious()) {
            if (Str::contains(strtolower($current->getMessage()), ['authenticationfailed', 'authentication failed', 'login failed', 'invalid credentials'])) {
                return true;
            }
        }

        return false;
    }

    public function close(): void
    {
        rescue(fn () => $this->client?->disconnect(), report: false);
        $this->client = null;
    }

    public function folders(): array
    {
        return $this->client()->getFolders(false)
            ->filter(fn (Folder $folder) => ! $folder->no_select)
            ->map(function (Folder $folder) {
                $status = rescue(fn () => $folder->status(), [], report: false);

                return [
                    'path' => $folder->path,
                    'name' => $folder->path === 'INBOX' ? 'Inbox' : (string) $folder->name,
                    'role' => FolderRoles::detect($folder->path),
                    'unread' => (int) ($status['unseen'] ?? 0),
                    'total' => (int) ($status['messages'] ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    public function messages(string $folder, int $page, int $perPage, string $filter = 'all', ?string $search = null): array
    {
        $query = $this->folder($folder)->query()->leaveUnread()->setFetchOrderDesc();

        if (str_starts_with($filter, 'label:')) {
            $keyword = Labels::keyword(substr($filter, 6)) ?? throw new \InvalidArgumentException('Unknown label.');
            $query->where("CUSTOM KEYWORD {$keyword}");
            $filter = 'label';
        }

        match ($filter) {
            'label' => null,
            'unread' => $query->unseen(),
            // webklex's flagged()/whereFlagged() wrongly require an argument; IMAP FLAGGED takes none.
            'flagged' => $query->where('FLAGGED'),
            'attachments' => $query->where('CUSTOM HEADER Content-Type', 'multipart/mixed'),
            default => $query->all(),
        };

        if ($search !== null && trim($search) !== '') {
            $query->text(trim($search));
        }

        $total = (clone $query)->count();
        $messages = $query->limit($perPage, max(1, $page))->get();

        return [
            // webklex picks the newest page, but returns it in the server's
            // ascending FETCH order — newest first within the page too.
            'messages' => $messages->map(fn (Message $message) => $this->summary($message))->sortByDesc('uid')->values()->all(),
            'total' => $total,
        ];
    }

    public function message(string $folder, int $uid, bool $markSeen = true): ?array
    {
        $message = $this->find($folder, $uid);

        if (! $message) {
            return null;
        }

        if ($markSeen) {
            rescue(fn () => $message->setFlag('Seen'), report: false);
        }

        $attachments = [];
        foreach ($message->getAttachments()->values() as $index => $attachment) {
            $attachments[] = [
                'index' => $index,
                'name' => (string) ($attachment->name ?: 'attachment-'.($index + 1)),
                'size' => (int) $attachment->size,
                'mime' => (string) ($attachment->content_type ?: 'application/octet-stream'),
                'content_id' => $attachment->id ? trim((string) $attachment->id, '<>') : null,
                'inline' => strtolower((string) $attachment->disposition) === 'inline',
            ];
        }

        $header = $message->getHeader();

        return $this->summary($message) + [
            'seen' => $markSeen ? true : $this->hasFlag($message, 'seen'),
            'cc' => $this->addresses($message->getCc()),
            'reply_to' => $this->addresses($message->getReplyTo()),
            'message_id' => (string) $message->getMessageId(),
            'references' => trim((string) $header?->get('references')),
            'html' => $message->hasHTMLBody() ? $message->getHTMLBody() : null,
            'text' => $message->hasTextBody() ? $message->getTextBody() : null,
            'attachments' => $attachments,
        ];
    }

    public function attachment(string $folder, int $uid, int $index): ?array
    {
        $attachment = $this->find($folder, $uid)?->getAttachments()->values()->get($index);

        if (! $attachment) {
            return null;
        }

        return [
            'name' => (string) ($attachment->name ?: 'attachment-'.($index + 1)),
            'mime' => (string) ($attachment->content_type ?: 'application/octet-stream'),
            'content' => (string) $attachment->content,
        ];
    }

    public function setFlags(string $folder, int $uid, ?bool $seen = null, ?bool $flagged = null): void
    {
        $message = $this->find($folder, $uid, withBody: false);

        if (! $message) {
            return;
        }

        if ($seen !== null) {
            $seen ? $message->setFlag('Seen') : $message->unsetFlag('Seen');
        }

        if ($flagged !== null) {
            $flagged ? $message->setFlag('Flagged') : $message->unsetFlag('Flagged');
        }
    }

    public function move(string $folder, int $uid, string $toFolder): void
    {
        $this->find($folder, $uid, withBody: false)?->move($toFolder, true);
    }

    public function delete(string $folder, int $uid): void
    {
        $this->find($folder, $uid, withBody: false)?->delete(true);
    }

    public function emptyFolder(string $path): int
    {
        $count = (int) ($this->folder($path)->status()['messages'] ?? 0);

        if ($count > 0) {
            // One STORE over the whole folder + EXPUNGE, not a delete per message.
            $this->client()->openFolder($path, true);
            $this->client()->getConnection()->store(['\\Deleted'], 1, $count, '+', true, IMAP::ST_MSGN)->validatedData();
            $this->client()->expunge();
        }

        return $count;
    }

    public function countFlagged(string $path): int
    {
        return rescue(fn () => $this->folder($path)->query()->where('FLAGGED')->count(), 0, report: false);
    }

    public function ensureFolder(string $path): void
    {
        if (! $this->client()->getFolderByPath($path, soft_fail: true)) {
            $this->client()->createFolder($path, false);
        }
    }

    public function append(string $folder, string $rawMessage, array $flags = []): void
    {
        $this->folder($folder)->appendMessage($rawMessage, $flags ?: null);
    }

    public function quota(): ?array
    {
        $response = rescue(fn () => $this->client()->getQuotaRoot('INBOX'), null, report: false);

        // e.g. * QUOTA "User quota" (STORAGE 2936012 10485760) — values in KiB.
        if ($response && preg_match('/STORAGE\D+(\d+)\D+(\d+)/', json_encode($response), $match)) {
            return ['used_bytes' => (int) $match[1] * 1024, 'limit_bytes' => (int) $match[2] * 1024];
        }

        return null;
    }

    public function setLabels(string $folder, int $uid, array $add = [], array $remove = []): void
    {
        $this->folder($folder);
        $this->client()->openFolder($folder);
        $connection = $this->client()->getConnection();

        foreach (['+' => $add, '-' => $remove] as $mode => $keys) {
            $keywords = array_values(array_filter(array_map(fn ($key) => Labels::keyword((string) $key), $keys)));
            if ($keywords !== []) {
                // Not Message::setFlag(): that prefixes "\", which only system flags have.
                $connection->store($keywords, $uid, $uid, $mode, true, IMAP::ST_UID)->validatedData();
            }
        }
    }

    public function findUidByMessageId(string $folder, string $messageId): ?int
    {
        $message = rescue(fn () => $this->folder($folder)->query()->leaveUnread()->setFetchBody(false)
            ->where('CUSTOM HEADER Message-ID '.$this->quoted($messageId))->limit(1)->get()->first(), null, report: false);

        return $message ? (int) $message->getUid() : null;
    }

    public function hasReplyTo(string $folder, string $messageId): bool
    {
        foreach (['In-Reply-To', 'References'] as $header) {
            $count = rescue(fn () => $this->folder($folder)->query()->leaveUnread()->setFetchBody(false)
                ->where("CUSTOM HEADER {$header} ".$this->quoted($messageId))->count(), 0, report: false);

            if ($count > 0) {
                return true;
            }
        }

        return false;
    }

    public function messagesWithAttachments(string $folder, ?int $aboveUid, ?int $belowUid, int $limit): array
    {
        $newMail = $belowUid === null && $aboveUid !== null;
        $query = $this->folder($folder)->query()->leaveUnread()
            ->where('CUSTOM HEADER Content-Type multipart/mixed');
        $newMail ? $query->setFetchOrderAsc() : $query->setFetchOrderDesc();

        if ($belowUid !== null) {
            if ($belowUid <= 1) {
                return [];
            }
            $query->where('CUSTOM UID 1:'.($belowUid - 1));
        } else {
            $query->where('CUSTOM UID '.(($aboveUid ?? 0) + 1).':*');
        }

        $messages = rescue(fn () => $query->limit($limit, 1)->get(), collect(), report: true);

        return collect($messages)
            // "UID n:*" still matches the last message when n is past the end.
            ->filter(fn (Message $message) => ! $newMail || (int) $message->getUid() > $aboveUid)
            ->values()
            ->map(function (Message $message) {
                $attachments = [];
                foreach ($message->getAttachments()->values() as $index => $attachment) {
                    // Images shown inside the email (cid:) aren't files the reader thinks of as attachments.
                    if ($attachment->id && strtolower((string) $attachment->disposition) === 'inline') {
                        continue;
                    }
                    $attachments[] = [
                        'index' => $index,
                        'name' => (string) ($attachment->name ?: 'attachment-'.($index + 1)),
                        'size' => (int) $attachment->size,
                        'mime' => (string) ($attachment->content_type ?: 'application/octet-stream'),
                    ];
                }
                $date = rescue(fn () => $message->getDate()->toDate(), null, report: false);

                return [
                    'uid' => (int) $message->getUid(),
                    'message_id' => (string) $message->getMessageId(),
                    'subject' => trim((string) $message->getSubject()) ?: '(no subject)',
                    'from' => $this->addresses($message->getFrom())[0] ?? ['name' => null, 'email' => null],
                    'date' => $date?->toIso8601String(),
                    'attachments' => $attachments,
                ];
            })
            // "UID n:*" also returns the newest email when n is past the end.
            ->filter(fn (array $m) => ($aboveUid === null || $m['uid'] > $aboveUid) && ($belowUid === null || $m['uid'] < $belowUid))
            ->sortBy('uid', descending: ! $newMail)
            ->values()
            ->all();
    }

    /** An IMAP quoted string. */
    private function quoted(string $value): string
    {
        return '"'.addcslashes($value, '"\\').'"';
    }

    private function client(): Client
    {
        if (! $this->client) {
            throw new MailServerUnavailable('Not connected to the mail server.');
        }

        return $this->client;
    }

    private function folder(string $path): Folder
    {
        $folder = $this->client()->getFolderByPath($path, soft_fail: true);

        if (! $folder) {
            throw new \InvalidArgumentException("Folder {$path} does not exist.");
        }

        return $folder;
    }

    private function find(string $folder, int $uid, bool $withBody = true): ?Message
    {
        $query = $this->folder($folder)->query()->leaveUnread();

        if (! $withBody) {
            $query->setFetchBody(false);
        }

        return rescue(fn () => $query->getMessageByUid($uid), null, report: false);
    }

    /** @return array<string, mixed> */
    private function summary(Message $message): array
    {
        $from = $this->addresses($message->getFrom())[0] ?? ['name' => null, 'email' => null];
        $text = $message->hasTextBody() ? $message->getTextBody() : strip_tags((string) ($message->hasHTMLBody() ? $message->getHTMLBody() : ''));
        $date = rescue(fn () => $message->getDate()->toDate(), null, report: false);

        return [
            'uid' => (int) $message->getUid(),
            'subject' => trim((string) $message->getSubject()) ?: '(no subject)',
            'from' => $from,
            'to' => $this->addresses($message->getTo()),
            'date' => $date?->toIso8601String(),
            'seen' => $this->hasFlag($message, 'seen'),
            'flagged' => $this->hasFlag($message, 'flagged'),
            'answered' => $this->hasFlag($message, 'answered'),
            'has_attachments' => $message->hasAttachments(),
            'snippet' => Str::limit(trim((string) preg_replace('/\s+/', ' ', html_entity_decode($text))), 140),
            'labels' => Labels::fromFlags($message->getFlags()->keys()->all()),
        ];
    }

    private function hasFlag(Message $message, string $flag): bool
    {
        return $message->getFlags()->has($flag);
    }

    /** @return array<int, array{name: ?string, email: string}> */
    private function addresses(mixed $attribute): array
    {
        $values = $attribute ? $attribute->toArray() : [];

        return collect($values)
            ->filter(fn ($address) => $address instanceof Address && $address->mail !== '')
            ->map(fn (Address $address) => ['name' => $address->personal !== '' ? $address->personal : null, 'email' => strtolower($address->mail)])
            ->values()
            ->all();
    }
}
