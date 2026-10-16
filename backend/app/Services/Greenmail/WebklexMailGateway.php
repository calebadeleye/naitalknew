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

        $manager = new ClientManager(['options' => [
            'fetch' => IMAP::FT_PEEK,
            'fetch_order' => 'desc',
            'soft_fail' => true,
            'rfc822' => true,
            'debug' => false,
        ]]);

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

        match ($filter) {
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
