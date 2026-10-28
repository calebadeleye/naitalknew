<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailCode;
use App\Models\Greenmail\GreenmailPushSubscription;
use App\Models\Greenmail\GreenmailSession;
use App\Models\Greenmail\GreenmailSetting;
use App\Models\MailboxRecord;
use App\Notifications\GreenmailCode as GreenmailCodeNotification;
use App\Notifications\GreenmailResetRequestedForOwner;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * A mailbox looking after itself: changing its password, a recovery email,
 * and resetting a forgotten password with a code sent to that recovery
 * email. Passwords are set on the mail server through ISPConfig.
 */
class MailboxAccount
{
    private const CODE_MINUTES = 15;

    private const MAX_ATTEMPTS = 5;

    public function __construct(private readonly ServerMailbox $server) {}

    /** Signed in: change the password. Other devices are signed out; this one stays signed in. */
    public function changePassword(GreenmailSession $session, string $current, string $new): void
    {
        if (! hash_equals($session->password(), $current) && ! hash_equals((string) $session->recentPreviousPassword(), $current)) {
            throw ValidationException::withMessages(['current_password' => 'Your current password is not right.']);
        }

        if ($new === $current) {
            throw ValidationException::withMessages(['password' => 'Choose a password different from your current one.']);
        }

        $this->setPassword($session->email, $new);

        $session->forceFill([
            'previous_password_encrypted' => $session->password_encrypted,
            'password_encrypted' => Crypt::encryptString($new),
            'password_changed_at' => now(),
        ])->save();

        GreenmailSession::query()->where('email', $session->email)->whereKeyNot($session->id)->delete();
        GreenmailPushSubscription::query()->where('owner_email', $session->email)->where(fn ($query) => $query->whereNull('session_id')->orWhere('session_id', '!=', $session->id))->delete();
        GreenmailPushSubscription::query()->where('session_id', $session->id)->update(['password_encrypted' => Crypt::encryptString($new)]);
    }

    /** Signed in: set (or remove) the recovery email; a code is sent to confirm it. */
    public function setRecoveryEmail(string $owner, ?string $recovery): void
    {
        $recovery = $recovery ? strtolower(trim($recovery)) : null;

        if ($recovery === strtolower($owner)) {
            throw ValidationException::withMessages(['recovery_email' => 'Use a different address — you would not be able to read it if you forget this mailbox password.']);
        }

        $settings = GreenmailSetting::query()->firstOrNew(['owner_email' => $owner]);
        $settings->forceFill(['recovery_email' => $recovery, 'recovery_email_verified_at' => null])->save();

        if ($recovery) {
            $this->sendCode($owner, 'verify_recovery', $recovery);
        }
    }

    public function confirmRecoveryEmail(string $owner, string $code): void
    {
        $settings = GreenmailSetting::query()->where('owner_email', $owner)->first();
        abort_unless($settings?->recovery_email, 422, 'Add a recovery email first.');

        $this->useCode($owner, 'verify_recovery', $code, $settings->recovery_email);
        $settings->forceFill(['recovery_email_verified_at' => now()])->save();
    }

    /**
     * Forgot password: a code to the confirmed recovery email, or — when there
     * isn't one — a note to the hosting account's owner. The caller never
     * learns which (or whether the mailbox exists).
     */
    public function requestReset(string $mailbox): void
    {
        $mailbox = strtolower(trim($mailbox));
        $settings = GreenmailSetting::query()->where('owner_email', $mailbox)->whereNotNull('recovery_email_verified_at')->first();

        if ($settings?->recovery_email) {
            $this->sendCode($mailbox, 'reset', $settings->recovery_email);

            return;
        }

        $record = MailboxRecord::query()->where('email_address', $mailbox)->first();
        $owner = $record?->hostingService?->client;
        $ownerEmail = $owner?->user?->email ?: $owner?->billing_email;

        if ($ownerEmail && strtolower($ownerEmail) !== $mailbox) {
            rescue(fn () => Notification::route('mail', $ownerEmail)->notifyNow(new GreenmailResetRequestedForOwner($mailbox)), report: true);
        }
    }

    /** Forgot password: the code from the recovery email, and the new password. */
    public function reset(string $mailbox, string $code, string $new): void
    {
        $mailbox = strtolower(trim($mailbox));
        $this->useCode($mailbox, 'reset', $code);
        $this->setPassword($mailbox, $new);

        // Every sign-in (and notification sign-up) used the old password.
        GreenmailSession::query()->where('email', $mailbox)->delete();
        GreenmailPushSubscription::query()->where('owner_email', $mailbox)->delete();
    }

    private function setPassword(string $mailbox, string $password): void
    {
        try {
            $this->server->modify($mailbox, fn () => ['password' => $password]);
        } catch (Exceptions\MailboxSettingsUnavailable $exception) {
            // The default text is about rules and vacation replies: not what someone changing a password needs to read.
            $generic = (new Exceptions\MailboxSettingsUnavailable)->getMessage();
            throw ValidationException::withMessages(['password' => $exception->getMessage() === $generic
                ? 'We couldn’t change this mailbox’s password here. Please contact NAI TALK support and we’ll do it for you.'
                : $exception->getMessage()]);
        } catch (Throwable $exception) {
            report($exception);
            throw ValidationException::withMessages(['password' => 'The password could not be changed on the mail server. Please try again, or try a different password.']);
        }
    }

    private function sendCode(string $owner, string $purpose, string $to): void
    {
        $code = (string) random_int(100000, 999999);

        GreenmailCode::query()->where('owner_email', $owner)->where('purpose', $purpose)->whereNull('used_at')->delete();
        GreenmailCode::query()->create([
            'owner_email' => $owner,
            'purpose' => $purpose,
            'target' => $to,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::CODE_MINUTES),
        ]);

        Notification::route('mail', $to)->notifyNow(new GreenmailCodeNotification($owner, $code, $purpose));
    }

    private function useCode(string $owner, string $purpose, string $code, ?string $target = null): void
    {
        $record = GreenmailCode::query()
            ->where('owner_email', $owner)
            ->where('purpose', $purpose)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->when($target, fn ($query) => $query->where('target', $target))
            ->latest('id')
            ->first();

        $field = 'code';

        if (! $record || $record->attempts >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages([$field => 'That code has expired. Ask for a new one.']);
        }

        if (! Hash::check(trim($code), $record->code_hash)) {
            $record->increment('attempts');
            throw ValidationException::withMessages([$field => $record->attempts >= self::MAX_ATTEMPTS ? 'Too many wrong tries. Ask for a new code.' : 'That code is not right.']);
        }

        $record->forceFill(['used_at' => now()])->save();
    }
}
