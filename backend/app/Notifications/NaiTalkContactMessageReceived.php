<?php

namespace App\Notifications;

use App\Models\ContactMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A contact-form message, to NAI TALK's inbox. Replying goes straight to the sender. */
class NaiTalkContactMessageReceived extends Notification
{
    use Queueable;

    public function __construct(public readonly ContactMessage $contact)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $c = $this->contact;

        return (new MailMessage)
            ->subject("New contact form message: {$c->service}")
            ->replyTo($c->email, $c->name)
            ->greeting('New message from the website')
            ->line("**Name:** {$c->name}")
            ->line("**Email:** {$c->email}")
            ->line('**Phone:** '.($c->phone ?: 'not given'))
            ->line("**Service:** {$c->service}")
            ->line('**Message:**')
            ->line($c->details)
            ->line('Reply to this email to answer '.$c->name.' directly.')
            ->salutation('NAI TALK website');
    }
}
