<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HostingSuspendedGracePeriodEnded extends Notification implements ShouldQueue
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
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/dashboard';

        return (new MailMessage)
            ->subject('Your NAI TALK hosting has been suspended')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Your grace period has ended and hosting for the following website has now been suspended.')
            ->line('**Domain:** '.($this->service->primary_domain ?: $this->service->service_number))
            ->line('Please renew as soon as possible — if this is not resolved, the website will eventually be removed from our servers.')
            ->action('Renew Now', $payUrl)
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
