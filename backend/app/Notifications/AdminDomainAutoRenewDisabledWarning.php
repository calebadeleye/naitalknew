<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Scaffolded for a future, explicit "disable registrar auto-renew when an
 * invoice goes unpaid" policy — no such policy exists in this codebase
 * today (the spec explicitly warns against ever doing this silently), so
 * this notification is currently unreferenced by any job/controller. Wire
 * it up only alongside a deliberate, configurable, logged, confirmation-
 * protected policy — never as a silent side effect of non-payment.
 */
class AdminDomainAutoRenewDisabledWarning extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain, public readonly string $reason) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Auto-renew disabled for {$this->domain->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Auto-renew was disabled for {$this->domain->domain_name}. Reason: {$this->reason}")
            ->action('Review Domain', rtrim(config('app.frontend_url'), '/').'/admin/domains');
    }
}
