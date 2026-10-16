<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailContact;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Each mailbox's own address book (people it sends to are added automatically). */
class ContactController extends Controller
{
    public function index(Request $request)
    {
        $search = trim((string) $request->query('q'));

        $contacts = GreenmailContact::query()
            ->where('owner_email', $this->owner($request))
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner
                ->where('email', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('company', 'like', "%{$search}%")))
            ->orderByRaw('name is null')
            ->orderBy('name')
            ->orderBy('email')
            ->limit($search !== '' ? 10 : 500)
            ->get();

        return response()->json(['contacts' => $contacts]);
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
