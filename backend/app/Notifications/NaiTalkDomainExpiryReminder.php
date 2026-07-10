<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainExpiryReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain, public readonly int $daysBeforeExpiry)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/domains';
        $whenText = $this->daysBeforeExpiry === 0
            ? 'expires today'
            : "expires in {$this->daysBeforeExpiry} day(s)";

        return (new MailMessage)
            ->subject($this->daysBeforeExpiry === 0
                ? "Your domain {$this->domain->domain_name} expires today"
                : "Your domain {$this->domain->domain_name} {$whenText}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("This is a reminder that your domain {$whenText}.")
            ->line('**Domain:** '.$this->domain->domain_name)
            ->line('**Expiry date:** '.optional($this->domain->expires_at)->toFormattedDateString())
            ->action('Renew Now', $payUrl)
            ->line('If this domain is not renewed before it expires, you risk losing it — it may enter a grace period and then become available for anyone else to register.');
    }
}
