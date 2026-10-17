<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * To the hosting account owner: someone asked to reset a mailbox's password,
 * and that mailbox has no recovery email — so the owner is asked to help.
 */
class GreenmailResetRequestedForOwner extends Notification
{
    use Queueable;

    public function __construct(public readonly string $mailbox)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim((string) config('app.frontend_url'), '/').'/client/dashboard';

        return (new MailMessage)
            ->subject("Password reset requested for {$this->mailbox}")
            ->line("Someone asked to reset the password for the mailbox **{$this->mailbox}** in Green Mail.")
            ->line("That mailbox has no recovery email set, so we can't send them a code. If it was one of your team, you can set a new password for them: open your website in the NAI TALK client area, go to **Email Accounts**, and click **Change Password** next to the mailbox.")
            ->line('Tip: once they are signed in, they can add a recovery email under Green Mail Settings > Security, so they can reset it themselves next time.')
            ->action('Open the client area', $url)
            ->line("If you didn't expect this, no action is needed — the password has not changed.");
    }
}
