<?php

namespace App\Notifications;

use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/** To the client: NAI TALK support has answered their ticket. */
class SupportTicketReplied extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly SupportTicket $ticket,
        public readonly SupportTicketMessage $reply,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url'), '/').'/client/support/'.$this->ticket->ticket_number;

        return (new MailMessage)
            ->subject("Re: [{$this->ticket->ticket_number}] {$this->ticket->subject}")
            ->greeting('Hi '.($notifiable->name ?? 'there').',')
            ->line('Our support team has replied to your ticket:')
            ->line('> '.Str::limit($this->reply->body, 600))
            ->action('View and Reply', $url)
            ->line('Please reply from your client area rather than to this email, so your message reaches the right person.');
    }
}
