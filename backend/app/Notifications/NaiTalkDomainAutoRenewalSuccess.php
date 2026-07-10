<?php

namespace App\Notifications;

use App\Models\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainAutoRenewalSuccess extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain, public readonly string $method)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $methodLabel = match ($this->method) {
            'wallet' => 'your NAI TALK wallet balance',
            'wallet_and_card' => 'your wallet balance plus your saved card',
            default => 'your saved card',
        };

        return (new MailMessage)
            ->subject("Your domain {$this->domain->domain_name} was renewed successfully")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Your domain renewal was paid successfully using {$methodLabel}.")
            ->line('**Domain:** '.$this->domain->domain_name)
            ->line('**New expiry date:** '.optional($this->domain->expires_at)->toFormattedDateString())
            ->line('No action is needed — your domain continues uninterrupted.');
    }
}
