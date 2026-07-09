<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkVerificationCode extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $code)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your NAI TALK verification code')
            ->greeting('Welcome to NAI TALK, '.$notifiable->name.'!')
            ->line('Enter the code below in the NAI TALK app to verify your email address and activate your account.')
            ->line('**'.$this->code.'**')
            ->line('This code expires in 15 minutes.')
            ->line('Once verified, your account can be used to order hosting, request website projects, pay invoices, and manage your services.')
            ->line('If you did not request this code, you can safely ignore this email.')
            ->line('Need help? Contact NAI TALK support at info@naitalk.com.');
    }
}
