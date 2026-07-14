<?php

namespace App\Notifications;

use App\Models\DomainOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admins whenever a domain registration order's payment clears —
 * registration is manual now (Spaceship is availability-check only), so an
 * admin must register the domain elsewhere and mark it done in the panel.
 */
class AdminDomainAwaitingManualRegistration extends Notification implements ShouldQueue
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
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin/domain-orders';

        return (new MailMessage)
            ->subject("Domain needs manual registration: {$this->domainOrder->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Payment has been confirmed for {$this->domainOrder->domain_name} — this domain needs to be registered manually.")
            ->line('Register it with your registrar of choice, then mark it as registered in the admin panel so the customer is notified.')
            ->action('Review Domain Orders', $adminUrl);
    }
}
