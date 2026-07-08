<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkHostingProvisioned extends Notification implements ShouldQueue
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
        $manageUrl = rtrim(config('app.frontend_url'), '/').'/client/services/'.$this->service->id.'/manage';

        return (new MailMessage)
            ->subject('Your NAI TALK hosting is live — thank you!')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Thank you for choosing NAI TALK SERVICES — we appreciate your business.')
            ->line('Your payment has been confirmed and your hosting service is now provisioned and ready to use.')
            ->line('**Domain:** '.$this->service->primary_domain)
            ->line('**Plan:** '.$this->service->hostingPlan?->name)
            ->action('Manage Your Hosting', $manageUrl)
            ->line('Need help getting started? Contact NAI TALK support at hello@naitalk.com.');
    }
}
