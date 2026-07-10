<?php

namespace App\Notifications;

use App\Models\DomainTransfer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainTransferActionRequired extends Notification implements ShouldQueue
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
            ->subject("Action required: approve the transfer of {$this->transfer->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("The transfer of {$this->transfer->domain_name} is awaiting an approval step — this is often a confirmation email from your current or new registrar, or a request to unlock the domain.")
            ->line('Please check your inbox (including the address on file with your current registrar) and complete any pending approval promptly, as transfers can be automatically rejected if not approved in time.');
    }
}
