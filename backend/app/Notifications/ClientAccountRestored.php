<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ClientAccountRestored extends Notification implements ShouldQueue
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your NAI TALK account has been restored')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Good news — your NAI TALK account has been restored and is active again.')
            ->line('If you have any questions, please contact support.')
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
