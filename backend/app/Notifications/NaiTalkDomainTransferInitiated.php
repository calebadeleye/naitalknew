<?php

namespace App\Notifications;

use App\Models\DomainTransfer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainTransferInitiated extends Notification implements ShouldQueue
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
            ->subject("Transfer initiated for {$this->transfer->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("We've initiated the transfer of {$this->transfer->domain_name} to NAI TALK.")
            ->line('Domain transfers typically take a few days and may require you to approve the transfer with your current registrar.')
            ->line('We will keep you updated as the transfer progresses.');
    }
}
