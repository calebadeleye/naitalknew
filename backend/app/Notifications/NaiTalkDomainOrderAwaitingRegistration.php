<?php

namespace App\Notifications;

use App\Models\Domain;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkDomainOrderAwaitingRegistration extends Notification implements ShouldQueue
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
            ->subject("Payment received for {$this->domain->domain_name}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("We've received your payment for {$this->domain->domain_name}.")
            ->line('Our team is finalizing the registration for you — your domain will be active within 24 hours.')
            ->line('**Domain:** '.$this->domain->domain_name);

        if ($invoice) {
            $breakdown = (new InvoiceBreakdown)->build($invoice);
            $message->line('**Subtotal:** '.$breakdown['subtotal'])
                ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
                ->line('**Total Paid:** '.$breakdown['amount_paid']);
        }

        return $message->line("We'll email you again as soon as {$this->domain->domain_name} is active.");
    }
}
