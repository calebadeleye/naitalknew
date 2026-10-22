<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Services\Greenmail\ExpoPushNotifications;
use App\Services\Greenmail\FolderRoles;
use App\Services\Greenmail\MailGateway;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The Green Mail phone app turning new-mail notifications on or off (Expo push tokens). */
class ExpoPushController extends Controller
{
    public function store(Request $request, ExpoPushNotifications $push)
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255', 'regex:/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_\-]+\]$/'],
            'platform' => ['nullable', Rule::in(['ios', 'android'])],
        ], ['token.regex' => 'That is not a valid notification token.']);

        // Only mail arriving from now on is announced.
        $mail = app(MailGateway::class);
        $inbox = FolderRoles::pathFor($mail->folders(), 'inbox') ?? 'INBOX';
        $latest = (int) (collect($mail->messages($inbox, 1, 1, 'all')['messages'])->max('uid') ?? 0);
        $push->register($request->attributes->get('greenmail_session'), $data['token'], $data['platform'] ?? null, $latest);

        return response()->json(['message' => 'Notifications are on for this phone.'], 201);
    }

    public function test(Request $request, ExpoPushNotifications $push)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:255']]);

        return match ($push->sendTest($this->owner($request), $data['token'])) {
            'sent' => response()->json(['message' => 'Test notification sent. It should appear in a few seconds.']),
            'missing' => response()->json(['message' => 'Notifications are not on for this phone. Turn them on first.'], 422),
            'expired' => response()->json(['message' => 'This phone stopped accepting notifications. Turn them on again.'], 422),
            default => response()->json(['message' => 'The notification service did not accept it. Please try again in a minute.'], 502),
        };
    }

    public function destroy(Request $request, ExpoPushNotifications $push)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:255']]);
        $push->unregister($this->owner($request), $data['token']);

        return response()->json(['message' => 'Notifications are off for this phone.']);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
