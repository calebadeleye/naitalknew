<?php

namespace App\Notifications;

use App\Models\DomainOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainRegistrationFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly DomainOrder $domainOrder)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("We couldn't register {$this->domainOrder->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("We're sorry — we were unable to register {$this->domainOrder->domain_name} on your behalf.")
            ->line('Your payment has not been lost; our support team has been notified and will reach out to resolve this, whether that means retrying registration, choosing another domain, or crediting your wallet.')
            ->line('If you have any questions in the meantime, please contact NAI TALK support.');
    }
}
