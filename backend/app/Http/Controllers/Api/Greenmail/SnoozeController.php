<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailSnooze;
use App\Services\Greenmail\FollowUps;
use App\Services\Greenmail\MailGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** Snoozed emails: snooze one until a time, list them, bring one back now. */
class SnoozeController extends Controller
{
    public function index(Request $request)
    {
        $snoozes = GreenmailSnooze::query()
            ->where('owner_email', $this->owner($request))
            ->where('status', 'snoozed')
            ->orderBy('until')
            ->limit(200)
            ->get(['id', 'message_id', 'subject', 'from_email', 'return_folder', 'until', 'status']);

        return response()->json(['snoozes' => $snoozes, 'folder' => FollowUps::SNOOZED_FOLDER]);
    }

    public function store(Request $request, FollowUps $followUps)
    {
        $data = $request->validate([
            'folder' => ['required', 'string', 'max:200'],
            'uid' => ['required', 'integer'],
            'until' => ['required', 'date', 'after:now', 'before:+1 year'],
        ], ['until.after' => 'Pick a time in the future.', 'until.before' => 'Pick a time within the next year.']);

        abort_if(GreenmailSnooze::query()->where('owner_email', $this->owner($request))->where('status', 'snoozed')->count() >= 200, 422, 'You have the most snoozed emails already. Bring some back first.');

        $until = Carbon::parse($data['until']);
        $snooze = $followUps->snooze($request->attributes->get('greenmail_session'), app(MailGateway::class), $data['folder'], (int) $data['uid'], $until);

        return response()->json(['snooze' => $snooze, 'message' => 'Snoozed until '.$until->copy()->timezone((string) $request->header('X-Timezone', 'Africa/Lagos'))->format('D j M, g:i a').'.'], 201);
    }

    public function destroy(Request $request, GreenmailSnooze $snooze, FollowUps $followUps)
    {
        abort_unless($snooze->owner_email === $this->owner($request) && $snooze->status === 'snoozed', 404);
        $followUps->unsnooze($snooze, app(MailGateway::class));

        return response()->json(['message' => 'Moved back to '.($snooze->return_folder === 'INBOX' ? 'Inbox' : $snooze->return_folder).'.']);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
