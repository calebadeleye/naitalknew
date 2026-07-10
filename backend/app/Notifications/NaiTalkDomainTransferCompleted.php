<?php

namespace App\Notifications;

use App\Models\DomainTransfer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainTransferCompleted extends Notification implements ShouldQueue
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
            ->subject("Transfer completed for {$this->transfer->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("{$this->transfer->domain_name} has been successfully transferred to NAI TALK.")
            ->line('You can now manage this domain, add hosting, and configure auto-renewal from your NAI TALK client dashboard.');
    }
}
