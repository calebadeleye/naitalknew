<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HostingProvisioningFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly HostingService $service, public readonly string $reason)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin/services?service='.$this->service->service_number;

        return (new MailMessage)
            ->subject("Hosting provisioning failed for {$this->service->service_number}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Automatic ISPConfig provisioning failed after exhausting all retries for the following hosting service.')
            ->line('**Service number:** '.$this->service->service_number)
            ->line('**Domain:** '.($this->service->primary_domain ?: 'not set'))
            ->line('**Reason:** '.$this->reason)
            ->action('Review in Admin Panel', $adminUrl)
            ->line('You can retry provisioning manually once the underlying issue is resolved.');
    }
}
