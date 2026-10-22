<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailFollowUp;
use App\Services\Greenmail\FollowUps;
use App\Services\Greenmail\MailGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Validation\Rule;

/** "Remind me if nobody replies": the waiting ones, the ones now due, and their actions. */
class FollowUpController extends Controller
{
    public function index(Request $request)
    {
        $items = GreenmailFollowUp::query()
            ->where('owner_email', $this->owner($request))
            ->whereIn('status', ['waiting', 'checking', 'due', 'failed'])
            ->orderByRaw("case status when 'due' then 0 when 'failed' then 1 else 2 end")
            ->orderBy('remind_at')
            ->limit(300)
            ->get(['id', 'message_id', 'subject', 'recipients', 'sent_folder', 'remind_at', 'status', 'checked_at', 'error']);

        return response()->json(['followups' => $items, 'due' => $items->where('status', 'due')->count()]);
    }

    /** From an email the mailbox sent (opened from Sent). */
    public function store(Request $request, FollowUps $followUps)
    {
        $data = $request->validate([
            'folder' => ['required', 'string', 'max:200'],
            'uid' => ['required', 'integer'],
            'remind_at' => ['required', 'date', 'after:now', 'before:+1 year'],
        ], ['remind_at.after' => 'Pick a time in the future.']);

        $this->ensureRoom($request);
        $message = app(MailGateway::class)->message($data['folder'], (int) $data['uid'], markSeen: false);
        abort_unless($message, 404, 'That email no longer exists.');
        abort_if(trim((string) $message['message_id']) === '', 422, 'A reminder can’t be set on this email.');

        $followUp = $followUps->remindIfNoReply(
            $request->attributes->get('greenmail_session'),
            $message['message_id'],
            $message['subject'],
            array_column(array_merge($message['to'], $message['cc'] ?? []), 'email'),
            $data['folder'],
            Carbon::parse($data['remind_at']),
        );

        return response()->json(['followup' => $followUp, 'message' => 'We’ll remind you if nobody replies.'], 201);
    }

    /** Dismiss it, or remind again later. */
    public function update(Request $request, GreenmailFollowUp $followUp)
    {
        abort_unless($followUp->owner_email === $this->owner($request), 404);
        $data = $request->validate([
            'action' => ['required', Rule::in(['dismiss', 'later'])],
            'remind_at' => ['required_if:action,later', 'nullable', 'date', 'after:now', 'before:+1 year'],
        ]);

        if ($data['action'] === 'dismiss') {
            $followUp->update(['status' => 'dismissed', 'password_encrypted' => null]);

            return response()->json(['message' => 'Reminder dismissed.']);
        }

        // Checked again for a reply at the new time, so it needs the mailbox password again.
        $followUp->update([
            'status' => 'waiting',
            'remind_at' => Carbon::parse($data['remind_at'])->utc(),
            'password_encrypted' => Crypt::encryptString($request->attributes->get('greenmail_session')->password()),
            'error' => null,
        ]);

        return response()->json(['followup' => $followUp->fresh(), 'message' => 'We’ll check again then.']);
    }

    public function destroy(Request $request, GreenmailFollowUp $followUp)
    {
        abort_unless($followUp->owner_email === $this->owner($request), 404);
        $followUp->delete();

        return response()->json(['message' => 'Reminder removed.']);
    }

    private function ensureRoom(Request $request): void
    {
        abort_if(GreenmailFollowUp::query()->where('owner_email', $this->owner($request))->where('status', 'waiting')->count() >= 300, 422, 'You have the most reminders waiting already.');
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
