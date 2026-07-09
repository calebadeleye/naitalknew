<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HostingExpiredNotice extends Notification implements ShouldQueue
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
            ->subject('Your NAI TALK hosting has expired')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Hosting for the following website has expired.')
            ->line('**Domain:** '.($this->service->primary_domain ?: $this->service->service_number))
            ->line('You have a '.config('hosting_lifecycle.grace_period_days').'-day grace period to renew before the website is suspended.')
            ->line('**Grace period ends:** '.($this->service->grace_period_ends_at?->toFormattedDateString() ?? 'soon'))
            ->action('Renew Now', $payUrl)
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
