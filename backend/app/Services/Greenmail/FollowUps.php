<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailFollowUp;
use App\Models\Greenmail\GreenmailSession;
use App\Models\Greenmail\GreenmailSnooze;
use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Throwable;

/**
 * Snooze ("bring this back on Monday at 9") and "remind me if nobody replies".
 *
 * A snoozed email is moved to the mailbox's Snoozed folder and moved back,
 * unread, when its time comes — so phones and other mail apps see it come
 * back too. A reminder checks the Inbox for a reply when it's due and only
 * bothers the person if there isn't one. Both run from greenmail:dispatch with
 * the mailbox password kept encrypted until they're done, like "Send later".
 */
class FollowUps
{
    public const SNOOZED_FOLDER = 'Snoozed';

    public function __construct(private readonly PushNotifications $push) {}

    /** Snoozes an email in the mailbox the request opened. */
    public function snooze(GreenmailSession $session, MailGateway $mail, string $folder, int $uid, Carbon $until): GreenmailSnooze
    {
        $message = $mail->message($folder, $uid, markSeen: false);
        abort_unless($message, 404, 'That email no longer exists.');
        abort_if(trim((string) $message['message_id']) === '', 422, 'This email can’t be snoozed.');
        abort_if($folder === self::SNOOZED_FOLDER, 422, 'This email is already snoozed.');

        $mail->ensureFolder(self::SNOOZED_FOLDER);
        $mail->move($folder, $uid, self::SNOOZED_FOLDER);

        // Snoozing the same email again just moves its time.
        GreenmailSnooze::query()->where('owner_email', $session->email)->where('message_id', $message['message_id'])->where('status', 'snoozed')->update(['status' => 'cancelled']);

        return GreenmailSnooze::query()->create([
            'owner_email' => $session->email,
            'password_encrypted' => Crypt::encryptString($session->password()),
            'message_id' => $message['message_id'],
            'subject' => $message['subject'],
            'from_email' => $message['from']['email'] ?? null,
            'return_folder' => $folder,
            'until' => $until->utc(),
        ]);
    }

    /** "Unsnooze": back to where it was, now. */
    public function unsnooze(GreenmailSnooze $snooze, MailGateway $mail): void
    {
        $this->bringBack($snooze, $mail);
        $snooze->update(['status' => 'cancelled', 'password_encrypted' => null]);
    }

    /** @return int emails brought back */
    public function returnDue(): int
    {
        $returned = 0;

        foreach (GreenmailSnooze::query()->where('status', 'snoozed')->where('until', '<=', now())->orderBy('until')->limit(100)->get() as $snooze) {
            if (GreenmailSnooze::query()->whereKey($snooze->id)->where('status', 'snoozed')->update(['status' => 'returning']) !== 1) {
                continue; // an overlapping run has it
            }

            $outcome = $this->withMailbox($snooze->owner_email, (string) $snooze->password_encrypted, fn (MailGateway $mail) => $this->bringBack($snooze, $mail));

            if ($outcome === true) {
                $snooze->update(['status' => 'returned', 'password_encrypted' => null, 'error' => null]);
                $returned++;
            } else {
                $snooze->update(['status' => 'failed', 'password_encrypted' => null, 'error' => $outcome]);
            }
        }

        return $returned;
    }

    public function remindIfNoReply(GreenmailSession $session, string $messageId, string $subject, array $recipients, ?string $sentFolder, Carbon $remindAt): GreenmailFollowUp
    {
        return GreenmailFollowUp::query()->updateOrCreate(
            ['owner_email' => $session->email, 'message_id' => $messageId, 'status' => 'waiting'],
            [
                'password_encrypted' => Crypt::encryptString($session->password()),
                'subject' => $subject ?: '(no subject)',
                'recipients' => array_values(array_unique(array_map('strtolower', $recipients))),
                'sent_folder' => $sentFolder,
                'remind_at' => $remindAt->utc(),
            ],
        );
    }

    /** @return int reminders that came due without a reply */
    public function checkDue(): int
    {
        $due = 0;

        foreach (GreenmailFollowUp::query()->where('status', 'waiting')->where('remind_at', '<=', now())->orderBy('remind_at')->limit(100)->get() as $followUp) {
            if (GreenmailFollowUp::query()->whereKey($followUp->id)->where('status', 'waiting')->update(['status' => 'checking']) !== 1) {
                continue;
            }

            $replied = $this->withMailbox($followUp->owner_email, (string) $followUp->password_encrypted, function (MailGateway $mail) use ($followUp) {
                $folders = $mail->folders();
                foreach (array_filter([FolderRoles::pathFor($folders, 'inbox') ?? 'INBOX', FolderRoles::pathFor($folders, 'archive')]) as $folder) {
                    if ($mail->hasReplyTo($folder, $followUp->message_id)) {
                        return 'replied';
                    }
                }

                return 'none';
            });

            if ($replied === 'replied') {
                $followUp->update(['status' => 'replied', 'checked_at' => now(), 'password_encrypted' => null]);

                continue;
            }

            if ($replied !== 'none') {
                $followUp->update(['status' => 'failed', 'checked_at' => now(), 'password_encrypted' => null, 'error' => $replied]);

                continue;
            }

            $followUp->update(['status' => 'due', 'checked_at' => now(), 'password_encrypted' => null]);
            $who = implode(', ', array_slice($followUp->recipients ?? [], 0, 2));
            rescue(fn () => $this->push->notifyOwner($followUp->owner_email, 'No reply yet', "{$followUp->subject}".($who ? " — {$who}" : ''), 'greenmail-followup-'.$followUp->id), report: true);
            $due++;
        }

        return $due;
    }

    private function bringBack(GreenmailSnooze $snooze, MailGateway $mail): bool
    {
        $uid = $mail->findUidByMessageId(self::SNOOZED_FOLDER, $snooze->message_id);

        if ($uid === null) {
            return true; // moved out of Snoozed by hand already: nothing to do
        }

        $target = collect($mail->folders())->contains(fn ($f) => $f['path'] === $snooze->return_folder)
            ? $snooze->return_folder
            : (FolderRoles::pathFor($mail->folders(), 'inbox') ?? 'INBOX');

        // Unread first: once moved it gets a new UID (and push-check sees it as new mail).
        $mail->setFlags(self::SNOOZED_FOLDER, $uid, seen: false);
        $mail->move(self::SNOOZED_FOLDER, $uid, $target);

        return true;
    }

    /** @return mixed the callback's result, or an error message */
    private function withMailbox(string $owner, string $passwordEncrypted, callable $work): mixed
    {
        try {
            $password = Crypt::decryptString($passwordEncrypted);
        } catch (Throwable) {
            return 'The mailbox could not be opened.';
        }

        $mail = app(MailGateway::class);

        try {
            $mail->open($owner, $password);

            return $work($mail);
        } catch (MailAuthenticationFailed) {
            return 'The mailbox password has changed since this was set.';
        } catch (Throwable $exception) {
            report($exception);

            return 'The mail server could not be reached.';
        } finally {
            rescue(fn () => $mail->close(), report: false);
        }
    }
}
