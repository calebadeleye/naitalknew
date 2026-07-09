<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HostingRenewalReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly HostingService $service,
        public readonly int $daysBeforeExpiry,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/dashboard';
        $plural = $this->daysBeforeExpiry === 1 ? 'day' : 'days';

        return (new MailMessage)
            ->subject("Your NAI TALK hosting renews in {$this->daysBeforeExpiry} {$plural}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Hosting for the following website is due for renewal in {$this->daysBeforeExpiry} {$plural}.")
            ->line('**Domain:** '.($this->service->primary_domain ?: $this->service->service_number))
            ->line('**Renewal date:** '.($this->service->renews_at?->toFormattedDateString() ?? 'soon'))
            ->action('Renew Now', $payUrl)
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
