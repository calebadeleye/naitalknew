<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WebsiteHostingDeactivated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly HostingService $service,
        public readonly string $reasonCategory,
        public readonly string $reasonNote,
        public readonly bool $isSecurityAction = false,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('Your website hosting has been deactivated')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Hosting for the following website has been deactivated.')
            ->line('**Domain:** '.($this->service->primary_domain ?: $this->service->service_number));

        if ($this->isSecurityAction) {
            $message->line('This was a security-related action taken to protect your website and our servers.');
        }

        return $message
            ->line('**Reason:** '.$this->reasonCategory.' — '.$this->reasonNote)
            ->line('Please contact support to review this and discuss reactivation.')
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
