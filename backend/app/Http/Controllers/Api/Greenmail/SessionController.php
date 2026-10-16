<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailSetting;
use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use App\Services\Greenmail\Exceptions\MailServerUnavailable;
use App\Services\Greenmail\GreenmailSessions;
use App\Services\Greenmail\MailGateway;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SessionController extends Controller
{
    public function store(Request $request, GreenmailSessions $sessions)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        try {
            ['token' => $token, 'session' => $session] = $sessions->signIn($data['email'], $data['password'], $request);
        } catch (MailAuthenticationFailed) {
            throw ValidationException::withMessages(['email' => ['Wrong email address or password.']]);
        } catch (MailServerUnavailable) {
            return response()->json(['message' => 'The mail server is not responding. Please try again in a moment.'], 503);
        }

        return response()->json(['token' => $token, 'email' => $session->email, 'expires_at' => $session->expires_at->toIso8601String()], 201);
    }

    /** Who is signed in, their name/signature and storage use. */
    public function show(Request $request, MailGateway $mail)
    {
        $session = $request->attributes->get('greenmail_session');
        $settings = GreenmailSetting::query()->where('owner_email', $session->email)->first();

        return response()->json([
            'email' => $session->email,
            'display_name' => $settings?->display_name,
            'signature_html' => $settings?->signature_html,
            'quota' => $mail->quota(),
        ]);
    }

    public function destroy(Request $request, GreenmailSessions $sessions)
    {
        $sessions->signOut($request->attributes->get('greenmail_session'));

        return response()->json(['message' => 'Signed out.']);
    }
}
