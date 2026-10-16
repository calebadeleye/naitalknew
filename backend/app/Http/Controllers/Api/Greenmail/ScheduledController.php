<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailScheduledMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** Emails waiting to be sent later (created by MailController::schedule). */
class ScheduledController extends Controller
{
    public function index(Request $request)
    {
        $items = GreenmailScheduledMessage::query()
            ->where('owner_email', $this->owner($request))
            ->where(fn ($query) => $query->whereIn('status', ['scheduled', 'sending', 'failed'])->orWhere('sent_at', '>', now()->subDays(7)))
            ->orderByRaw("case when status = 'scheduled' then 0 else 1 end")
            ->orderBy('send_at')
            ->limit(100)
            ->get();

        return response()->json(['scheduled' => $items]);
    }

    /** Cancel one that hasn't gone out, or clear a failed/sent one from the list. */
    public function destroy(Request $request, GreenmailScheduledMessage $scheduled)
    {
        abort_unless($scheduled->owner_email === $this->owner($request), 404);
        abort_if($scheduled->status === 'sending', 422, 'It is being sent right now.');

        $wasWaiting = $scheduled->status === 'scheduled';
        Storage::disk('local')->delete($scheduled->raw_path);
        $scheduled->delete();

        return response()->json(['message' => $wasWaiting ? 'Scheduled email cancelled.' : 'Removed from the list.']);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
