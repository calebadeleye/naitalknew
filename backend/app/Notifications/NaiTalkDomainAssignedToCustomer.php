<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainAssignedToCustomer extends Notification implements ShouldQueue
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
            ->subject("Your domain {$this->domain->domain_name} has been added to your NAI TALK account")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("The domain **{$this->domain->domain_name}** is now linked to your NAI TALK account.")
            ->line('You can view its status, renewal date, and manage auto-renew from your dashboard.')
            ->action('View My Domains', rtrim(config('app.frontend_url'), '/').'/client/domains');
    }
}
