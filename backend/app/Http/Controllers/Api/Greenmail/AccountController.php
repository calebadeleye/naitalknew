<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Services\Greenmail\MailboxAccount;
use Illuminate\Http\Request;

/** Signed in: change the mailbox password, and set the recovery email used if it's ever forgotten. */
class AccountController extends Controller
{
    public function changePassword(Request $request, MailboxAccount $account)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string', 'max:200'],
            'password' => ['required', 'string', 'min:8', 'max:100', 'confirmed'],
        ], ['password.confirmed' => 'The two new passwords do not match.']);

        $account->changePassword($request->attributes->get('greenmail_session'), $data['current_password'], $data['password']);

        return response()->json(['message' => 'Password changed. Other devices have been signed out; use the new password there.']);
    }

    public function setRecoveryEmail(Request $request, MailboxAccount $account)
    {
        $data = $request->validate(['recovery_email' => ['nullable', 'email', 'max:190']]);
        $account->setRecoveryEmail($request->attributes->get('greenmail_session')->email, $data['recovery_email'] ?? null);

        return response()->json(['message' => filled($data['recovery_email'] ?? null)
            ? "We've sent a 6-digit code to {$data['recovery_email']}. Enter it to confirm."
            : 'Recovery email removed.']);
    }

    public function confirmRecoveryEmail(Request $request, MailboxAccount $account)
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $account->confirmRecoveryEmail($request->attributes->get('greenmail_session')->email, $data['code']);

        return response()->json(['message' => 'Recovery email confirmed. If you forget your password, you can reset it with a code sent there.']);
    }
}
