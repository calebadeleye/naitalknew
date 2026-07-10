<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkAutoRenewalSuccess extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Invoice $invoice, public readonly string $method)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $breakdown = (new InvoiceBreakdown)->build($this->invoice);

        $methodLabel = match ($this->method) {
            'wallet' => 'your NAI TALK wallet balance',
            'wallet_and_card' => 'your wallet balance plus your saved card',
            'card' => 'your saved card',
            default => 'your account',
        };

        return (new MailMessage)
            ->subject('Your NAI TALK hosting was renewed successfully')
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Your hosting renewal was paid successfully using {$methodLabel}.")
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Amount Paid:** '.$breakdown['amount_paid'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->line('No action is needed — your service continues uninterrupted.');
    }
}
