<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Generic admin alert for any ISPConfig action job that exhausted its
 * retries — deactivate/reactivate/delete website, etc. Kept separate from
 * HostingProvisioningFailed (which is specific to initial provisioning).
 */
class IspConfigActionFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly HostingService $service,
        public readonly string $action,
        public readonly string $reason,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin/services?service='.$this->service->service_number;

        return (new MailMessage)
            ->subject("ISPConfig action failed: {$this->action}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("The action \"{$this->action}\" failed after exhausting all retries for the following hosting service.")
            ->line('**Service number:** '.$this->service->service_number)
            ->line('**Domain:** '.($this->service->primary_domain ?: 'not set'))
            ->line('**Reason:** '.$this->reason)
            ->action('Review in Admin Panel', $adminUrl)
            ->line('You can retry manually once the underlying issue is resolved.');
    }
}
