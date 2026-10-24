<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Notifications\GreenmailDeletionRequested;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/** Signed in: ask NAI TALK to delete this mailbox and its Green Mail data (the app's "Delete account and data"). */
class DeletionRequestController extends Controller
{
    public function __invoke(Request $request)
    {
        $session = $request->attributes->get('greenmail_session');
        $data = $request->validate(['password' => ['required', 'string', 'max:200']]);

        // Asking again for the password makes sure it is the owner and not someone holding an unlocked phone.
        if (! hash_equals($session->password(), $data['password'])) {
            throw ValidationException::withMessages(['password' => ['That password is not right.']]);
        }

        Log::info('Green Mail: deletion requested', ['mailbox' => $session->email]);
        Notification::route('mail', (string) config('company.email', 'info@naitalk.com'))->notify(new GreenmailDeletionRequested($session->email, true));
        Notification::route('mail', $session->email)->notify(new GreenmailDeletionRequested($session->email, false));

        return response()->json(['message' => 'We received your request. We will delete your mailbox and its Green Mail data and confirm by email.'], 201);
    }
}
