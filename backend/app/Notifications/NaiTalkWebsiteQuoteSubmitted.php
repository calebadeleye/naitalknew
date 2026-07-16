<?php

namespace App\Notifications;

use App\Models\WebsiteQuoteRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Alerts NAITALK staff (super_admin/admin_staff) whenever a new website
 * quote request is submitted from the Google Ads landing page.
 */
class NaiTalkWebsiteQuoteSubmitted extends Notification implements ShouldQueue
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
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin/website-quotes';

        return (new MailMessage)
            ->subject('New website quote request: '.$this->quote->reference)
            ->greeting('Hi '.$notifiable->name.',')
            ->line('A new website quote request was submitted.')
            ->line('**Reference:** '.$this->quote->reference)
            ->line('**Name:** '.$this->quote->name)
            ->line('**Phone/WhatsApp:** '.$this->quote->phone)
            ->line('**Email:** '.$this->quote->email)
            ->line('**Website type:** '.$this->quote->website_type)
            ->line('**Budget:** '.$this->quote->estimated_budget)
            ->line('**Project description:** '.$this->quote->project_description)
            ->line('**UTM campaign:** '.($this->quote->utm_campaign ?: '—'))
            ->line('**UTM term:** '.($this->quote->utm_term ?: '—'))
            ->line('**GCLID:** '.($this->quote->gclid ?: '—'))
            ->line('**Referring page:** '.($this->quote->referrer ?: '—'))
            ->line('**Submitted:** '.$this->quote->created_at->format('d M Y, h:i A'))
            ->action('Review Enquiry', $adminUrl);
    }
}
