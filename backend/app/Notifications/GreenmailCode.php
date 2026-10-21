<?php

namespace App\Notifications;

use App\Support\MailBlocks;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A Green Mail code: to reset a mailbox password, or to confirm a recovery email. Sent straight away (not queued). */
class GreenmailCode extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $mailbox,
        public readonly string $code,
        public readonly string $purpose,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($this->purpose === 'verify_recovery') {
            return (new MailMessage)
                ->subject("Your Green Mail confirmation code: {$this->code}")
                ->line("You're adding this address as the recovery email for **{$this->mailbox}** in Green Mail.")
                ->line(MailBlocks::code('Confirmation Code', $this->code, 'This code expires in 15 minutes.'))
                ->line("If you didn't ask for this, you can ignore this email.");
        }

        return (new MailMessage)
            ->subject("Reset your Green Mail password: {$this->code}")
            ->line("Someone asked to reset the password for **{$this->mailbox}**.")
            ->line('Enter this code in Green Mail to choose a new password.')
            ->line(MailBlocks::code('Reset Code', $this->code, 'This code expires in 15 minutes.'))
            ->line("If you didn't ask for this, ignore this email — your password stays the same.");
    }
}
