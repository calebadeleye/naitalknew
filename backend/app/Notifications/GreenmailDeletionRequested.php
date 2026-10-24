<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Someone asked, from the Green Mail app, for their mailbox and its data to be
 * deleted. Goes to NAI TALK support (to act on) and back to the mailbox itself
 * (so the person has a record). Nothing is deleted until support has done it.
 */
class GreenmailDeletionRequested extends Notification
{
    use Queueable;

    public function __construct(public readonly string $mailbox, public readonly bool $forSupport)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($this->forSupport) {
            return (new MailMessage)
                ->subject("Green Mail deletion request: {$this->mailbox}")
                ->line("The owner of the mailbox **{$this->mailbox}** asked, in the Green Mail app (signed in with the mailbox password), to have the mailbox and its Green Mail data deleted.")
                ->line('Check that the request is genuine (it came from a signed-in session), tell the hosting account owner if it is not the owner themselves, then delete the mailbox and its Green Mail data (calendar events, tasks, notes, templates, contacts, filters, scheduled emails, notification registrations) and reply to the person to confirm.');
        }

        return (new MailMessage)
            ->subject('We received your Green Mail deletion request')
            ->line("We received your request to delete the mailbox **{$this->mailbox}** and its Green Mail data.")
            ->line('We will carry it out and confirm by email. If you did not make this request, reply to this message right away and we will stop it.');
    }
}
