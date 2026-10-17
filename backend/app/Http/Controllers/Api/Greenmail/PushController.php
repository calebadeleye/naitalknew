<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailPushSubscription;
use App\Services\Greenmail\FolderRoles;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\PushNotifications;
use Illuminate\Http\Request;

/** Turning phone/desktop notifications on or off for this device. */
class PushController extends Controller
{
    /** Public: the key a browser needs to sign up (null when notifications aren't set up on the server). */
    public function key()
    {
        return response()->json(['public_key' => PushNotifications::configured() ? config('greenmail.vapid.public_key') : null]);
    }

    public function status(Request $request)
    {
        $endpoint = (string) $request->query('endpoint', '');

        return response()->json([
            'available' => PushNotifications::configured(),
            'this_device' => $endpoint !== '' && GreenmailPushSubscription::query()->where('owner_email', $this->owner($request))->where('endpoint_hash', hash('sha256', $endpoint))->exists(),
        ]);
    }

    public function store(Request $request, PushNotifications $push)
    {
        abort_unless(PushNotifications::configured(), 503, 'Notifications are not available yet.');

        $data = $request->validate([
            'endpoint' => ['required', 'url', 'starts_with:https://', 'max:1000'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'domain' => ['nullable', 'string', 'max:190'],
        ]);

        // Only mail arriving from now on is announced.
        $mail = app(MailGateway::class);
        $inbox = FolderRoles::pathFor($mail->folders(), 'inbox') ?? 'INBOX';
        $latest = (int) (collect($mail->messages($inbox, 1, 1, 'all')['messages'])->max('uid') ?? 0);

        $push->subscribe($request->attributes->get('greenmail_session'), $data, $latest);

        return response()->json(['message' => 'Notifications are on for this device.'], 201);
    }

    public function test(Request $request, PushNotifications $push)
    {
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:1000']]);

        return match ($push->sendTest($this->owner($request), $data['endpoint'])) {
            'sent' => response()->json(['message' => 'Test notification sent. It should appear in a few seconds.']),
            'missing' => response()->json(['message' => 'Notifications are not on for this device. Turn them on first.'], 422),
            'expired' => response()->json(['message' => 'This device stopped accepting notifications. Turn them on again.'], 422),
            default => response()->json(['message' => 'The notification service did not accept it. Please try again in a minute.'], 502),
        };
    }

    /** When turning notifications on fails in the browser, it reports why here (for support). */
    public function problem(Request $request)
    {
        $data = $request->validate(['stage' => ['required', 'string', 'max:40'], 'message' => ['nullable', 'string', 'max:500'], 'standalone' => ['nullable', 'boolean']]);

        \Illuminate\Support\Facades\Log::warning('Green Mail: turning on notifications failed', $data + [
            'mailbox' => $this->owner($request),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 300),
        ]);

        return response()->json(['message' => 'Thanks — noted.']);
    }

    public function destroy(Request $request, PushNotifications $push)
    {
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:1000']]);
        $push->unsubscribe($this->owner($request), $data['endpoint']);

        return response()->json(['message' => 'Notifications are off for this device.']);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
