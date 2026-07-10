<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\DomainContact;
use Illuminate\Http\Request;

class DomainContactController extends Controller
{
    public function show(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $contact = DomainContact::query()->where('client_id', $client->id)->first();

        return response()->json([
            'data' => $contact,
            'is_complete' => $contact?->isComplete() ?? false,
        ]);
    }

    public function update(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:120'],
            'state' => ['required', 'string', 'max:120'],
            'country' => ['required', 'string', 'max:120'],
            'postal_code' => ['required', 'string', 'max:20'],
        ]);

        $contact = DomainContact::query()->updateOrCreate(['client_id' => $client->id], $payload);

        return response()->json(['data' => $contact, 'is_complete' => $contact->isComplete()]);
    }
}
