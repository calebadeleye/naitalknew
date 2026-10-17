<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Services\Greenmail\MailboxAccount;
use Illuminate\Http\Request;

/** Public: forgot password — a code by email, then a new password. */
class PasswordResetController extends Controller
{
    public function forgot(Request $request, MailboxAccount $account)
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:190']]);

        rescue(fn () => $account->requestReset($data['email']), report: true);

        // The same answer whatever happened, so nobody can use this to find out which mailboxes exist.
        return response()->json(['message' => 'If this mailbox has a recovery email, we have sent a 6-digit code to it. If it does not, we have asked the owner of the website account to help you.']);
    }

    public function reset(Request $request, MailboxAccount $account)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'code' => ['required', 'string', 'max:10'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed'],
        ], ['password.confirmed' => 'The two new passwords do not match.']);

        $account->reset($data['email'], $data['code'], $data['password']);

        return response()->json(['message' => 'Your password has been changed. Sign in with your new password.']);
    }
}
