<?php

namespace App\Http\Middleware;

use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use App\Services\Greenmail\Exceptions\MailServerUnavailable;
use App\Services\Greenmail\GreenmailSessions;
use App\Services\Greenmail\MailGateway;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Greenmail API requests carry X-Greenmail-Token. This resolves the session,
 * opens the mailbox for the request and closes it afterwards. If the mailbox
 * password was changed elsewhere, the session ends (401) and the user signs
 * in again.
 */
class AuthenticateGreenmail
{
    public function __construct(private readonly GreenmailSessions $sessions, private readonly MailGateway $mail)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $session = $this->sessions->find($request->header('X-Greenmail-Token'));

        if (! $session) {
            return response()->json(['message' => 'Please sign in to your mailbox.'], 401);
        }

        try {
            $this->mail->open($session->email, $session->password());
        } catch (MailAuthenticationFailed) {
            $this->sessions->signOut($session);

            return response()->json(['message' => 'Your mailbox password has changed. Please sign in again.'], 401);
        } catch (MailServerUnavailable) {
            return response()->json(['message' => 'The mail server is not responding. Please try again in a moment.'], 503);
        }

        $request->attributes->set('greenmail_session', $session);

        try {
            return $next($request);
        } finally {
            $this->mail->close();
        }
    }
}
