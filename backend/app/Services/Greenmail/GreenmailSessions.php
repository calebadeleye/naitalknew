<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

/**
 * Signed-in Greenmail browsers. The browser holds only a random token; the
 * mailbox password it unlocks is kept encrypted server-side and deleted on
 * sign-out, after inactivity, or at the absolute limit. "Keep me signed in"
 * sessions get the longer remembered_* limits.
 */
class GreenmailSessions
{
    public function __construct(private readonly MailGateway $mail)
    {
    }

    /** @return array{token: string, session: GreenmailSession} */
    public function signIn(string $email, string $password, Request $request, bool $remember = false): array
    {
        $email = strtolower(trim($email));

        $this->mail->open($email, $password); // throws when the login is wrong
        $this->mail->close();

        $token = 'gm_'.Str::random(64);
        $session = GreenmailSession::query()->create([
            'token_hash' => hash('sha256', $token),
            'email' => $email,
            'password_encrypted' => Crypt::encryptString($password),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            'remember' => $remember,
            'last_used_at' => now(),
            'expires_at' => now()->addDays((int) config($remember ? 'greenmail.remembered_max_days' : 'greenmail.session_max_days')),
        ]);

        return ['token' => $token, 'session' => $session];
    }

    public function find(?string $token): ?GreenmailSession
    {
        if (! $token || ! str_starts_with($token, 'gm_')) {
            return null;
        }

        $session = GreenmailSession::query()->where('token_hash', hash('sha256', $token))->first();

        if (! $session) {
            return null;
        }

        if ($session->expires_at->isPast() || $session->last_used_at->lt($this->idleLimit($session->remember))) {
            $session->delete();

            return null;
        }

        // Only write "last used" about once a minute, not on every request.
        if ($session->last_used_at->lt(now()->subMinute())) {
            $session->forceFill(['last_used_at' => now()])->save();
        }

        return $session;
    }

    public function signOut(GreenmailSession $session): void
    {
        $session->delete();
    }

    public function pruneExpired(): int
    {
        return GreenmailSession::query()
            ->where('expires_at', '<', now())
            ->orWhere(fn ($q) => $q->where('remember', false)->where('last_used_at', '<', $this->idleLimit(false)))
            ->orWhere(fn ($q) => $q->where('remember', true)->where('last_used_at', '<', $this->idleLimit(true)))
            ->delete();
    }

    /** Sessions not used since this time are signed out. */
    private function idleLimit(bool $remember): \Illuminate\Support\Carbon
    {
        return $remember
            ? now()->subDays((int) config('greenmail.remembered_idle_days'))
            : now()->subMinutes((int) config('greenmail.session_idle_minutes'));
    }
}
