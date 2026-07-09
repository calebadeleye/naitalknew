<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ClientAccountSuspended extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $reasonCategory,
        public readonly string $reasonNote,
        public readonly ?string $effectiveAt = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your NAI TALK account has been suspended')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Your NAI TALK account has been suspended.')
            ->line('**Reason:** '.$this->reasonCategory.' — '.$this->reasonNote)
            ->line('**Effective:** '.($this->effectiveAt ?: 'immediately'))
            ->line('While suspended, your hosting services may be temporarily unavailable. Please contact support to resolve this and restore your account.')
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
