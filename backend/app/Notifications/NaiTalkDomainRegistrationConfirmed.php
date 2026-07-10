<?php

namespace App\Notifications;

use App\Models\Domain;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainRegistrationConfirmed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $invoice = $this->domain->orders()->where('order_type', 'registration')->latest()->first()?->invoice;

        $message = (new MailMessage)
            ->subject("Your domain {$this->domain->domain_name} is registered")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Good news — {$this->domain->domain_name} has been registered successfully and is now active on your NAI TALK account.")
            ->line('**Domain:** '.$this->domain->domain_name)
            ->line('**Expiry date:** '.optional($this->domain->expires_at)->toFormattedDateString());

        if ($invoice) {
            $breakdown = (new InvoiceBreakdown)->build($invoice);
            $message->line('**Subtotal:** '.$breakdown['subtotal'])
                ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
                ->line('**Total Paid:** '.$breakdown['amount_paid']);
        }

        return $message->line('You can manage this domain, renewal, and auto-renewal from your NAI TALK client dashboard.');
    }
}
