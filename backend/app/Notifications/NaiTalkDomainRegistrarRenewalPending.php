<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent once when a renewal payment has cleared but the registrar itself
 * hasn't yet confirmed the renewal (async provider) — deduped via
 * NotificationLog so this fires exactly once per renewal cycle, not on
 * every sync poll while it stays pending.
 */
class NaiTalkDomainRegistrarRenewalPending extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Your domain {$this->domain->domain_name} renewal payment was received")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("We've received payment for your domain **{$this->domain->domain_name}** renewal.")
            ->line("We're waiting for final confirmation from the registrar — this usually completes shortly, and we'll let you know once it does.")
            ->line('No further action is needed from you.');
    }
}
