<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailNote;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Plain notes for the mailbox — pinned first, then most recently edited. */
class NoteController extends Controller
{
    public const COLORS = ['yellow', 'green', 'blue', 'pink', 'gray'];

    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));

        $notes = GreenmailNote::query()
            ->where('owner_email', $this->owner($request))
            ->when($q !== '', fn ($query) => $query->where(fn ($inner) => $inner->where('title', 'like', "%{$q}%")->orWhere('body', 'like', "%{$q}%")))
            ->orderByDesc('pinned')
            ->orderByDesc('updated_at')
            ->limit(500)
            ->get();

        return response()->json(['notes' => $notes]);
    }

    public function store(Request $request)
    {
        $note = GreenmailNote::query()->create($this->validated($request) + ['owner_email' => $this->owner($request)]);

        return response()->json(['note' => $note->fresh(), 'message' => 'Note saved.'], 201);
    }

    public function update(Request $request, GreenmailNote $note)
    {
        abort_unless($note->owner_email === $this->owner($request), 404);
        $note->update($this->validated($request));

        return response()->json(['note' => $note->fresh(), 'message' => 'Note saved.']);
    }

    public function destroy(Request $request, GreenmailNote $note)
    {
        abort_unless($note->owner_email === $this->owner($request), 404);
        $note->delete();

        return response()->json(['message' => 'Note deleted.']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:20000'],
            'color' => ['nullable', Rule::in(self::COLORS)],
            'pinned' => ['nullable', 'boolean'],
        ]);

        abort_if(blank($data['title'] ?? null) && blank($data['body'] ?? null), 422, 'Write something in the note first.');

        return ['pinned' => (bool) ($data['pinned'] ?? false)] + $data;
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
