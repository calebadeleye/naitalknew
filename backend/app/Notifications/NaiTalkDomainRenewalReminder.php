<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent instead of NaiTalkDomainAutoRenewalFailed when there simply was no
 * wallet balance and no enabled saved card to charge — nothing "failed",
 * there was just nothing to attempt payment with.
 */
class NaiTalkDomainRenewalReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain)
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
            ->subject("Your domain {$this->domain->domain_name} renewal is due")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Your domain renewal is due and we could not find a wallet balance or an enabled saved card to charge automatically.")
            ->line('**Domain:** '.$this->domain->domain_name)
            ->line('**Expiry date:** '.optional($this->domain->expires_at)->toFormattedDateString())
            ->action('Renew Now', $payUrl)
            ->line('Please fund your wallet or add a saved card for automatic renewals, or renew this domain directly to keep it active.');
    }
}
