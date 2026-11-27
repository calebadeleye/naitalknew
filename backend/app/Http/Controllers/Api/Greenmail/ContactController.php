<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailContact;
use App\Models\Greenmail\GreenmailContactGroup;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Each mailbox's own address book (people it sends to are added automatically),
 * its contact groups, and uploading a list (a CSV read in the browser).
 */
class ContactController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('q'));
        $owner = $this->owner($request);
        // Campaigns ask for everyone (all=1); the side panel and To-field suggestions need fewer.
        $limit = $search !== '' ? 10 : ($request->boolean('all') ? 10000 : 500);

        $contacts = GreenmailContact::query()
            ->where('owner_email', $owner)
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner
                ->where('email', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('company', 'like', "%{$search}%")))
            ->orderByRaw('name is null')
            ->orderBy('name')
            ->orderBy('email')
            ->limit($limit)
            ->get();

        if (! $request->boolean('all')) {
            return response()->json(['contacts' => $contacts]);
        }

        $members = DB::table('greenmail_contact_group_members')->whereIn('contact_id', $contacts->pluck('id'))->get()->groupBy('contact_id');
        $contacts->each(fn ($c) => $c->setAttribute('group_ids', $members->get($c->id)?->pluck('group_id')->values()->all() ?? []));

        return response()->json([
            'contacts' => $contacts,
            'groups' => $this->groups($owner),
            'total' => GreenmailContact::query()->where('owner_email', $owner)->count(),
        ]);
    }

    /**
     * Adds an uploaded list. New addresses become contacts; ones already there
     * keep their details and only get blanks filled in. Optionally all of them
     * go into a group (an existing one, or a new one by name).
     */
    public function import(Request $request)
    {
        $owner = $this->owner($request);
        $data = $request->validate([
            'contacts' => ['required', 'array', 'min:1', 'max:10000'],
            'contacts.*.email' => ['required', 'string', 'max:190'],
            'contacts.*.name' => ['nullable', 'string', 'max:160'],
            'contacts.*.phone' => ['nullable', 'string', 'max:60'],
            'contacts.*.company' => ['nullable', 'string', 'max:160'],
            'group_id' => ['nullable', 'integer'],
            'group_name' => ['nullable', 'string', 'max:80'],
        ], ['contacts.max' => 'Upload at most 10,000 contacts at a time.']);

        $group = $this->groupFor($owner, $data['group_id'] ?? null, $data['group_name'] ?? null);

        $rows = collect($data['contacts'])
            ->map(fn ($row) => [
                'email' => strtolower(trim($row['email'])),
                'name' => $this->clean($row['name'] ?? null),
                'phone' => $this->clean($row['phone'] ?? null),
                'company' => $this->clean($row['company'] ?? null),
            ]);
        $valid = $rows->filter(fn ($row) => filter_var($row['email'], FILTER_VALIDATE_EMAIL) && $row['email'] !== $owner)->unique('email')->values();
        $invalid = $rows->count() - $rows->filter(fn ($row) => filter_var($row['email'], FILTER_VALIDATE_EMAIL))->count();

        [$created, $updated, $ids] = DB::transaction(function () use ($owner, $valid) {
            $created = 0;
            $updated = 0;
            $ids = [];
            foreach ($valid->chunk(500) as $chunk) {
                $existing = GreenmailContact::query()->where('owner_email', $owner)->whereIn('email', $chunk->pluck('email'))->get()->keyBy('email');
                $new = [];
                foreach ($chunk as $row) {
                    $contact = $existing->get($row['email']);
                    if (! $contact) {
                        $new[] = $row + ['owner_email' => $owner, 'created_at' => now(), 'updated_at' => now()];

                        continue;
                    }
                    $ids[] = $contact->id;
                    $blanks = array_filter(['name' => $row['name'], 'phone' => $row['phone'], 'company' => $row['company']], fn ($value, $field) => $value !== null && blank($contact->{$field}), ARRAY_FILTER_USE_BOTH);
                    if ($blanks) {
                        $contact->update($blanks);
                        $updated++;
                    }
                }
                if ($new) {
                    GreenmailContact::query()->insert($new);
                    $created += count($new);
                    array_push($ids, ...GreenmailContact::query()->where('owner_email', $owner)->whereIn('email', array_column($new, 'email'))->pluck('id')->all());
                }
            }

            return [$created, $updated, $ids];
        });

        if ($group) {
            foreach (array_chunk($ids, 500) as $chunk) {
                $group->contacts()->syncWithoutDetaching($chunk);
            }
        }

        $parts = array_filter([
            $created ? "{$created} added" : null,
            ($already = count($ids) - $created) ? "{$already} already in your contacts" : null,
            $invalid ? "{$invalid} skipped (not an email address)" : null,
        ]);

        return response()->json([
            'message' => ($parts ? ucfirst(implode(', ', $parts)) : 'Nothing to add').($group ? " · in the group “{$group->name}”" : '').'.',
            'created' => $created,
            'updated' => $updated,
            'invalid' => $invalid,
            'contact_ids' => $ids,
            'group' => $group ? $this->groups($owner)->firstWhere('id', $group->id) : null,
        ]);
    }

    public function storeGroup(Request $request)
    {
        $owner = $this->owner($request);
        $group = $this->groupFor($owner, null, $request->validate(['name' => ['required', 'string', 'max:80']])['name']);

        return response()->json(['group' => $this->groups($owner)->firstWhere('id', $group->id)], 201);
    }

    public function updateGroup(Request $request, GreenmailContactGroup $group)
    {
        $owner = $this->owner($request);
        abort_unless($group->owner_email === $owner, 404);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80', Rule::unique('greenmail_contact_groups', 'name')->where('owner_email', $owner)->ignore($group->id)],
            'add' => ['nullable', 'array'],
            'add.*' => ['integer'],
            'remove' => ['nullable', 'array'],
            'remove.*' => ['integer'],
        ], ['name.unique' => 'You already have a group with that name.']);

        if (isset($data['name'])) {
            $group->update(['name' => trim($data['name'])]);
        }
        if ($data['add'] ?? []) {
            $group->contacts()->syncWithoutDetaching(GreenmailContact::query()->where('owner_email', $owner)->whereIn('id', $data['add'])->pluck('id'));
        }
        if ($data['remove'] ?? []) {
            $group->contacts()->detach($data['remove']);
        }

        return response()->json(['group' => $this->groups($owner)->firstWhere('id', $group->id)]);
    }

    /** Deletes the group only; its people stay in the contacts. */
    public function destroyGroup(Request $request, GreenmailContactGroup $group)
    {
        abort_unless($group->owner_email === $this->owner($request), 404);
        $group->delete();

        return response()->json(['message' => 'Group deleted. The people in it are still in your contacts.']);
    }

    private function groups(string $owner)
    {
        return GreenmailContactGroup::query()->where('owner_email', $owner)->withCount('contacts')->orderBy('name')->get(['id', 'name']);
    }

    private function groupFor(string $owner, ?int $id, ?string $name): ?GreenmailContactGroup
    {
        if ($id) {
            return GreenmailContactGroup::query()->where('owner_email', $owner)->findOrFail($id);
        }
        $name = $this->clean($name);

        return $name ? GreenmailContactGroup::query()->firstOrCreate(['owner_email' => $owner, 'name' => $name]) : null;
    }

    private function clean(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    public function store(Request $request)
    {
        $owner = $this->owner($request);
        $data = $this->validated($request, $owner);

        return response()->json(['contact' => GreenmailContact::query()->create($data + ['owner_email' => $owner])], 201);
    }

    public function update(Request $request, GreenmailContact $contact)
    {
        $owner = $this->owner($request);
        abort_unless($contact->owner_email === $owner, 404);

        $contact->update($this->validated($request, $owner, $contact->id));

        return response()->json(['contact' => $contact]);
    }

    public function destroy(Request $request, GreenmailContact $contact)
    {
        abort_unless($contact->owner_email === $this->owner($request), 404);
        $contact->delete();

        return response()->json(['message' => 'Contact deleted.']);
    }

    private function validated(Request $request, string $owner, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:190', Rule::unique('greenmail_contacts', 'email')->where('owner_email', $owner)->ignore($ignoreId)],
            'phone' => ['nullable', 'string', 'max:60'],
            'company' => ['nullable', 'string', 'max:160'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], ['email.unique' => 'That address is already in your contacts.']);

        return ['email' => strtolower($data['email'])] + $data;
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
