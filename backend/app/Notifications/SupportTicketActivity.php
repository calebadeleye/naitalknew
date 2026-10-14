<?php

namespace App\Notifications;

use App\Models\SupportTicket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/** To NAI TALK staff: a client opened a ticket or replied to one. */
class SupportTicketActivity extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly SupportTicket $ticket,
        public readonly string $event,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $client = $this->ticket->client;
        $who = $client?->company_name ?: $client?->user?->name ?: 'A client';
        $verb = $this->event === 'opened' ? 'opened a new ticket' : 'replied to a ticket';
        $url = rtrim(config('app.frontend_url'), '/').'/admin/support?ticket='.$this->ticket->ticket_number;

        $message = (new MailMessage)
            ->subject(($this->event === 'opened' ? 'New ticket' : 'Client reply').": [{$this->ticket->ticket_number}] {$this->ticket->subject}")
            ->line("**{$who}** ({$client?->user?->email}) {$verb}.")
            ->line('**Category:** '.ucfirst($this->ticket->category).' · **Priority:** '.ucfirst($this->ticket->priority));

        if ($this->ticket->hostingService) {
            $message->line('**Website:** '.($this->ticket->hostingService->primary_domain ?: $this->ticket->hostingService->service_number));
        }

        return $message
            ->line('> '.Str::limit((string) $this->ticket->latest_message, 600))
            ->action('Open Ticket', $url);
    }
}
