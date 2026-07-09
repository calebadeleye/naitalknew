<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HostingDeletedFromIspConfig extends Notification implements ShouldQueue
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
            ->subject('Your website hosting has been removed')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Because renewal was not completed within the grace period, hosting for the following website has been removed from our server.')
            ->line('**Domain:** '.($this->service->primary_domain ?: $this->service->service_number))
            ->line('Your NAI TALK account remains active — only this hosting service was affected. Contact support if you would like to set up hosting again.')
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
