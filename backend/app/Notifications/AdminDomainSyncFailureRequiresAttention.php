<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AdminDomainSyncFailureRequiresAttention extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $failedCount, public readonly string $provider = 'cloudflare') {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin/domains';

        return (new MailMessage)
            ->subject("{$this->provider} domain sync: {$this->failedCount} record(s) failed")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("The last {$this->provider} registrar sync failed to process {$this->failedCount} domain record(s).")
            ->line('Check the sync history on the affected domains for details, and retry once the underlying issue is resolved.')
            ->action('Review Domains', $adminUrl);
    }
}
