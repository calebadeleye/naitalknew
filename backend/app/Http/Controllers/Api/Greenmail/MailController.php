<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailContact;
use App\Models\Greenmail\GreenmailSetting;
use App\Services\Greenmail\FolderRoles;
use App\Services\Greenmail\HtmlSanitizer;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\MailSender;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

/** Folders, message list, reading, flags, moving and sending for the signed-in mailbox. */
class MailController extends Controller
{
    /**
     * The mailbox opened for THIS request by the greenmail middleware. Looked
     * up each time rather than held in the constructor: Laravel keeps route
     * controllers alive between requests in long-running workers, and a held
     * instance would be a closed connection from an earlier request.
     */
    private function mail(): MailGateway
    {
        return app(MailGateway::class);
    }

    public function folders()
    {
        $folders = collect($this->mail()->folders())
            ->sortBy(fn (array $folder) => [array_search($folder['role'], FolderRoles::ORDER, true) === false ? 99 : array_search($folder['role'], FolderRoles::ORDER, true), strtolower($folder['name'])])
            ->values();

        $inbox = FolderRoles::pathFor($folders->all(), 'inbox') ?? 'INBOX';

        return response()->json(['folders' => $folders, 'starred' => $this->mail()->countFlagged($inbox)]);
    }

    /** "Empty Spam" / "Empty Trash": deletes everything in it on the server. Other folders are refused. */
    public function emptyFolder(Request $request)
    {
        $folder = $this->folderParam($request);
        $role = collect($this->mail()->folders())->firstWhere('path', $folder)['role'] ?? null;

        abort_unless(in_array($role, ['junk', 'trash'], true), 422, 'Only Spam and Trash can be emptied.');

        $count = $this->inFolder(fn () => $this->mail()->emptyFolder($folder));

        return response()->json(['message' => $count === 1 ? '1 message deleted.' : "{$count} messages deleted.", 'deleted' => $count]);
    }

    /** One action on several selected messages. */
    public function bulk(Request $request)
    {
        $data = $request->validate([
            'folder' => ['required', 'string', 'max:200'],
            'uids' => ['required', 'array', 'min:1', 'max:200'],
            'uids.*' => ['integer'],
            'action' => ['required', Rule::in(['delete', 'archive', 'spam', 'not_spam', 'read', 'unread', 'star', 'unstar'])],
        ]);
        $folder = $data['folder'];
        $action = $data['action'];

        $target = match ($action) {
            'delete' => $this->folderForRole('trash'),
            'archive' => $this->folderForRole('archive'),
            'spam' => $this->folderForRole('junk'),
            'not_spam' => $this->folderForRole('inbox'),
            default => null,
        };

        $this->inFolder(function () use ($data, $folder, $action, $target) {
            foreach ($data['uids'] as $uid) {
                match ($action) {
                    'read', 'unread' => $this->mail()->setFlags($folder, (int) $uid, seen: $action === 'read'),
                    'star', 'unstar' => $this->mail()->setFlags($folder, (int) $uid, flagged: $action === 'star'),
                    // Deleting from Trash removes for good; anywhere else it moves to Trash.
                    'delete' => $folder === $target ? $this->mail()->delete($folder, (int) $uid) : $this->mail()->move($folder, (int) $uid, $target),
                    default => $this->mail()->move($folder, (int) $uid, $target),
                };
            }
        });

        $count = count($data['uids']);
        $noun = $count === 1 ? 'message' : 'messages';

        return response()->json(['message' => match ($action) {
            'delete' => $folder === $target ? "{$count} {$noun} deleted for good." : "{$count} {$noun} moved to Trash.",
            'archive' => "{$count} {$noun} archived.",
            'spam' => "{$count} {$noun} moved to Spam.",
            'not_spam' => "{$count} {$noun} moved to Inbox.",
            default => 'Updated.',
        }]);
    }

    public function index(Request $request)
    {
        $data = $request->validate([
            'folder' => ['required', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
            'filter' => ['nullable', Rule::in(['all', 'unread', 'flagged', 'attachments'])],
            'q' => ['nullable', 'string', 'max:200'],
        ]);
        $perPage = (int) config('greenmail.per_page');
        $page = (int) ($data['page'] ?? 1);

        $result = $this->inFolder(fn () => $this->mail()->messages($data['folder'], $page, $perPage, $data['filter'] ?? 'all', $data['q'] ?? null));

        return response()->json($result + ['page' => $page, 'per_page' => $perPage, 'last_page' => max(1, (int) ceil($result['total'] / $perPage))]);
    }

    public function show(Request $request, int $uid, HtmlSanitizer $sanitizer)
    {
        $folder = $this->folderParam($request);
        $message = $this->inFolder(fn () => $this->mail()->message($folder, $uid));
        abort_unless($message, 404, 'That message no longer exists.');

        // Inline (cid:) images become data: URIs; capped so a huge one can't bloat the page.
        $inline = [];
        foreach ($message['attachments'] as $attachment) {
            if ($attachment['content_id'] && str_starts_with($attachment['mime'], 'image/') && $attachment['size'] <= 2 * 1048576) {
                $file = $this->mail()->attachment($folder, $uid, $attachment['index']);
                if ($file) {
                    $inline[$attachment['content_id']] = 'data:'.$attachment['mime'].';base64,'.base64_encode($file['content']);
                }
            }
        }

        $html = $message['html'] !== null
            ? $sanitizer->clean($message['html'], $inline)
            : '<div style="white-space:pre-wrap">'.e((string) $message['text']).'</div>';

        return response()->json(array_merge($message, [
            'html' => $html,
            'has_remote_images' => (bool) preg_match('/<img[^>]+src=["\']https?:/i', $html),
            // Images already shown inline aren't listed again as attachments.
            'attachments' => collect($message['attachments'])->reject(fn ($a) => $a['content_id'] && isset($inline[$a['content_id']]))->values()->all(),
        ]));
    }

    public function attachment(Request $request, int $uid, int $index)
    {
        $folder = $this->folderParam($request);
        $file = $this->inFolder(fn () => $this->mail()->attachment($folder, $uid, $index));
        abort_unless($file, 404, 'That attachment no longer exists.');

        return response($file['content'], 200, [
            'Content-Type' => $file['mime'],
            'Content-Disposition' => 'attachment; filename="'.str_replace('"', '', $file['name']).'"',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function update(Request $request, int $uid)
    {
        $data = $request->validate([
            'folder' => ['required', 'string', 'max:200'],
            'seen' => ['nullable', 'boolean'],
            'flagged' => ['nullable', 'boolean'],
        ]);

        $this->inFolder(fn () => $this->mail()->setFlags($data['folder'], $uid, $data['seen'] ?? null, $data['flagged'] ?? null));

        return response()->json(['message' => 'Updated.']);
    }

    /** Move to another folder, or to the mailbox's Archive / Junk / Inbox by role. */
    public function move(Request $request, int $uid)
    {
        $data = $request->validate([
            'folder' => ['required', 'string', 'max:200'],
            'to' => ['nullable', 'string', 'max:200'],
            'to_role' => ['nullable', Rule::in(['archive', 'junk', 'inbox', 'trash'])],
        ]);

        $target = $data['to'] ?? $this->folderForRole($data['to_role'] ?? 'archive');
        $this->inFolder(fn () => $this->mail()->move($data['folder'], $uid, $target));

        return response()->json(['message' => 'Moved.', 'to' => $target]);
    }

    /** Delete: to Trash, or for good when it's already in Trash. */
    public function destroy(Request $request, int $uid)
    {
        $folder = $this->folderParam($request);
        $trash = $this->folderForRole('trash');

        $this->inFolder(fn () => $folder === $trash ? $this->mail()->delete($folder, $uid) : $this->mail()->move($folder, $uid, $trash));

        return response()->json(['message' => $folder === $trash ? 'Deleted for good.' : 'Moved to Trash.']);
    }

    public function send(Request $request, MailSender $sender)
    {
        $data = $this->validateCompose($request, requireRecipient: true);
        $session = $request->attributes->get('greenmail_session');
        $settings = GreenmailSetting::query()->where('owner_email', $session->email)->first();

        try {
            $raw = $sender->send($session->email, $settings?->display_name, $session->password(), $data, $request->file('attachments', []));
        } catch (TransportExceptionInterface $exception) {
            report($exception);

            return response()->json(['message' => 'The message could not be sent: '.Str::limit($exception->getMessage(), 160)], 422);
        }

        // Keep a copy in Sent, mark what was answered, drop the draft it came from.
        rescue(fn () => $this->mail()->append($this->folderForRole('sent'), $raw, ['\\Seen']), report: true);

        if (! empty($data['reply_uid']) && ! empty($data['reply_folder'])) {
            rescue(fn () => $this->mail()->setFlags($data['reply_folder'], (int) $data['reply_uid'], seen: true), report: false);
        }

        if (! empty($data['draft_uid'])) {
            rescue(fn () => $this->mail()->delete($this->folderForRole('drafts'), (int) $data['draft_uid']), report: false);
        }

        $this->rememberRecipients($session->email, array_merge($data['to'], $data['cc'] ?? [], $data['bcc'] ?? []));

        return response()->json(['message' => 'Sent.'], 201);
    }

    public function saveDraft(Request $request, MailSender $sender)
    {
        $data = $this->validateCompose($request, requireRecipient: false);
        $session = $request->attributes->get('greenmail_session');
        $settings = GreenmailSetting::query()->where('owner_email', $session->email)->first();
        $drafts = $this->folderForRole('drafts');

        $this->mail()->append($drafts, $sender->compose($session->email, $settings?->display_name, $data, $request->file('attachments', [])), ['\\Seen', '\\Draft']);

        if (! empty($data['draft_uid'])) {
            rescue(fn () => $this->mail()->delete($drafts, (int) $data['draft_uid']), report: false);
        }

        return response()->json(['message' => 'Draft saved.']);
    }

    private function validateCompose(Request $request, bool $requireRecipient): array
    {
        // Recipient fields arrive as "a@x.com, b@y.com" strings or arrays.
        foreach (['to', 'cc', 'bcc'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $request->merge([$field => array_values(array_filter(array_map('trim', preg_split('/[,;]+/', $value))))]);
            }
        }

        $maxKb = (int) config('greenmail.max_attachment_mb') * 1024;

        return $request->validate([
            'to' => [$requireRecipient ? 'required' : 'nullable', 'array', 'max:50'],
            'to.*' => ['email'],
            'cc' => ['nullable', 'array', 'max:50'],
            'cc.*' => ['email'],
            'bcc' => ['nullable', 'array', 'max:50'],
            'bcc.*' => ['email'],
            'subject' => ['nullable', 'string', 'max:300'],
            'html' => ['nullable', 'string', 'max:2000000'],
            'in_reply_to' => ['nullable', 'string', 'max:500'],
            'references' => ['nullable', 'string', 'max:5000'],
            'reply_uid' => ['nullable', 'integer'],
            'reply_folder' => ['nullable', 'string', 'max:200'],
            'draft_uid' => ['nullable', 'integer'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file', "max:{$maxKb}"],
        ], ['to.required' => 'Add at least one recipient.']) + ['to' => [], 'subject' => '', 'html' => ''];
    }

    private function rememberRecipients(string $owner, array $addresses): void
    {
        foreach (array_unique(array_map('strtolower', $addresses)) as $address) {
            GreenmailContact::query()->firstOrCreate(['owner_email' => $owner, 'email' => $address]);
        }
    }

    private function folderForRole(string $role): string
    {
        $path = FolderRoles::pathFor($this->mail()->folders(), $role);

        if ($path) {
            return $path;
        }

        $path = match ($role) {
            'inbox' => 'INBOX',
            'sent' => 'Sent',
            'drafts' => 'Drafts',
            'junk' => 'Junk',
            'trash' => 'Trash',
            default => 'Archive',
        };
        $this->mail()->ensureFolder($path);

        return $path;
    }

    private function folderParam(Request $request): string
    {
        return (string) $request->validate(['folder' => ['required', 'string', 'max:200']])['folder'];
    }

    private function inFolder(\Closure $action): mixed
    {
        try {
            return $action();
        } catch (InvalidArgumentException $exception) {
            abort(404, $exception->getMessage());
        } catch (Throwable $exception) {
            report($exception);
            abort(503, 'The mail server could not complete that. Please try again.');
        }
    }
}
