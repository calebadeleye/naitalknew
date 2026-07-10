<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainAutoRenewalFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain, public readonly string $reason)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/domains';

        return (new MailMessage)
            ->subject("Action required: your domain {$this->domain->domain_name} renewal payment failed")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("We were unable to automatically renew {$this->domain->domain_name}. Your domain has not been renewed and remains due for renewal.")
            ->line('**Domain:** '.$this->domain->domain_name)
            ->line('**Current expiry date:** '.optional($this->domain->expires_at)->toFormattedDateString())
            ->action('Renew Now', $payUrl)
            ->line('Please fund your wallet, add a payment method, or renew this domain directly to avoid losing it.');
    }
}
