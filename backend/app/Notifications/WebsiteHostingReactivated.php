<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WebsiteHostingReactivated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly HostingService $service)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your website hosting has been reactivated')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Good news — hosting for the following website has been reactivated.')
            ->line('**Domain:** '.($this->service->primary_domain ?: $this->service->service_number))
            ->line('Your website should be accessible again shortly.')
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
