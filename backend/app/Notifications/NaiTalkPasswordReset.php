<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkPasswordReset extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $resetUrl) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Reset your NAI TALK password')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('We received a request to reset the password for your NAI TALK account.')
            ->action('Reset Password', $this->resetUrl)
            ->line('This link expires in 60 minutes.')
            ->line('If you did not request a password reset, you can safely ignore this email.');
    }
}
