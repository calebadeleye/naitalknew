<?php

namespace App\Notifications;

use App\Models\DomainTransfer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainTransferFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly DomainTransfer $transfer)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Transfer failed for {$this->transfer->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Unfortunately the transfer of {$this->transfer->domain_name} to NAI TALK did not complete.")
            ->line('**Reason:** '.($this->transfer->failure_reason ?: 'Not specified'))
            ->line('Your domain record has been kept so you can retry — please double-check your EPP/auth code and that the domain is unlocked at your current registrar, then contact support to try again.');
    }
}
