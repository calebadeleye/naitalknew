<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Services\Greenmail\Vacation;
use Illuminate\Http\Request;

/** The out-of-office reply for the signed-in mailbox. */
class VacationController extends Controller
{
    public function show(Request $request, Vacation $vacation)
    {
        return response()->json(['vacation' => $vacation->get($this->owner($request))]);
    }

    public function update(Request $request, Vacation $vacation)
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'subject' => ['nullable', 'string', 'max:200'],
            'message' => ['nullable', 'required_if:enabled,true', 'string', 'max:4000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:now'],
        ], [
            'message.required_if' => 'Write the reply people will get.',
            'ends_at.after' => 'The end date has already passed.',
        ]);

        abort_if(filled($data['starts_at'] ?? null) && filled($data['ends_at'] ?? null) && strtotime($data['ends_at']) <= strtotime($data['starts_at']), 422, 'The end must be after the start.');

        $saved = $vacation->set($this->owner($request), $data + ['enabled' => (bool) $data['enabled']]);

        return response()->json([
            'vacation' => $saved,
            'message' => $saved['enabled'] ? 'Vacation reply is on. It starts working within a minute.' : 'Vacation reply is off.',
        ]);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
