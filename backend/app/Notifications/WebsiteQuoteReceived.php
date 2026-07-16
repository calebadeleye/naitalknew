<?php

namespace App\Notifications;

use App\Models\WebsiteQuoteRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Acknowledgement email sent to the prospect right after they submit the
 * website-design landing page quote form.
 */
class WebsiteQuoteReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly WebsiteQuoteRequest $quote)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('We received your website request – NAITALK')
            ->greeting('Hi '.$this->quote->name.',')
            ->line('Thank you for reaching out to NAITALK. We have received your request for a '.$this->quote->website_type.'.')
            ->line('**Your reference:** '.$this->quote->reference)
            ->line('Our team will review your request and contact you shortly using the details you provided.')
            ->line('**Phone/WhatsApp:** 07087057654')
            ->line('**Email:** info@naitalk.com');
    }
}
