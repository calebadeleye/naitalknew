<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailAttachment;
use App\Models\Greenmail\GreenmailSharedFile;
use App\Services\Greenmail\AttachmentIndex;
use App\Services\Greenmail\FileShares;
use App\Services\Greenmail\MailGateway;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The attachment manager: browse and search every file in the mailbox, and share one securely. */
class AttachmentController extends Controller
{
    public function index(Request $request, AttachmentIndex $index)
    {
        $data = $request->validate([
            'kind' => ['nullable', Rule::in(['all', 'pdf', 'image', 'document', 'spreadsheet', 'presentation', 'archive', 'other'])],
            'q' => ['nullable', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
            'sync' => ['nullable', 'boolean'],
            'reset' => ['nullable', 'boolean'],
        ]);
        $owner = $this->owner($request);

        if ($request->boolean('reset')) {
            $index->reset($owner);
        }

        // Each visit indexes a little more (new mail first, then older mail).
        $progress = $request->boolean('sync', true)
            ? rescue(fn () => $index->sync($owner, app(MailGateway::class)), ['pending' => false, 'indexed' => 0], report: true)
            : ['pending' => false, 'indexed' => 0];

        $kind = $data['kind'] ?? 'all';
        $q = trim((string) ($data['q'] ?? ''));

        $page = GreenmailAttachment::query()
            ->where('owner_email', $owner)
            ->when($kind !== 'all', fn ($query) => $query->where('kind', $kind))
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                ->where('name', 'like', '%'.addcslashes($q, '%_\\').'%')
                ->orWhere('from_email', 'like', '%'.addcslashes($q, '%_\\').'%')
                ->orWhere('from_name', 'like', '%'.addcslashes($q, '%_\\').'%')
                ->orWhere('subject', 'like', '%'.addcslashes($q, '%_\\').'%')))
            ->orderByDesc('sent_at')
            ->orderByDesc('id')
            ->paginate(40, ['id', 'folder', 'uid', 'part_index', 'name', 'extension', 'kind', 'mime', 'size', 'from_name', 'from_email', 'subject', 'sent_at', 'warning'], 'page', (int) ($data['page'] ?? 1));

        $counts = GreenmailAttachment::query()->where('owner_email', $owner)->selectRaw('kind, count(*) as total')->groupBy('kind')->pluck('total', 'kind');

        return response()->json([
            'attachments' => collect($page->items())->map(fn (GreenmailAttachment $a) => $a->toArray() + [
                'previewable' => in_array(strtolower((string) $a->mime), AttachmentIndex::PREVIEWABLE_MIME, true),
            ])->all(),
            'page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            'counts' => $counts,
            'indexing' => $progress['pending'],
        ]);
    }

    /** Forget an entry whose email has gone (the app calls this when opening it fails). */
    public function forget(Request $request, AttachmentIndex $index)
    {
        $data = $request->validate(['folder' => ['required', 'string', 'max:200'], 'uid' => ['required', 'integer']]);
        $index->forget($this->owner($request), $data['folder'], (int) $data['uid']);

        return response()->json(['message' => 'Removed.']);
    }

    public function share(Request $request, FileShares $shares)
    {
        $data = $request->validate([
            'folder' => ['required', 'string', 'max:200'],
            'uid' => ['required', 'integer'],
            'index' => ['required', 'integer', 'min:0'],
            'days' => ['nullable', 'integer', 'min:1', 'max:30'],
            'max_downloads' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
        $owner = $this->owner($request);

        abort_if(GreenmailSharedFile::query()->where('owner_email', $owner)->whereNull('revoked_at')->where('expires_at', '>', now())->count() >= FileShares::MAX_ACTIVE, 422, 'You have the most share links open already. Stop sharing one first.');

        $file = app(MailGateway::class)->attachment($data['folder'], (int) $data['uid'], (int) $data['index']);
        abort_unless($file, 404, 'That attachment no longer exists.');

        $warning = AttachmentIndex::classify($file['name'], $file['mime'])['warning'];
        abort_if($warning !== null && ! str_starts_with($warning, 'Compressed'), 422, 'This file could be harmful, so it can’t be shared by link.');

        $share = $shares->create($owner, $file, (int) ($data['days'] ?? 7), $data['max_downloads'] ?? null);

        return response()->json(['share' => $share, 'url' => $shares->url($share), 'message' => 'Link created. It stops working on '.$share->expires_at->timezone('Africa/Lagos')->format('j M Y').'.'], 201);
    }

    public function shares(Request $request, FileShares $shares)
    {
        $items = GreenmailSharedFile::query()
            ->where('owner_email', $this->owner($request))
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['shares' => $items->map(fn (GreenmailSharedFile $s) => $s->toArray() + ['url' => $shares->url($s), 'available' => $s->isAvailable()])]);
    }

    public function revoke(Request $request, GreenmailSharedFile $share, FileShares $shares)
    {
        abort_unless($share->owner_email === $this->owner($request), 404);
        $shares->revoke($share);

        return response()->json(['message' => 'The link no longer works.']);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
