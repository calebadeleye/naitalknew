<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkUnderpaymentReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Invoice $invoice)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $breakdown = (new InvoiceBreakdown)->build($this->invoice);

        return (new MailMessage)
            ->subject("Partial payment received for invoice {$this->invoice->invoice_number}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('We received '.$breakdown['amount_paid'].' for your invoice, but the total payable amount is '.$breakdown['total'].'. Your payment has been saved in your NAI TALK wallet. Please pay the remaining '.$breakdown['outstanding_amount'].' before your service can be activated.')
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Amount Paid:** '.$breakdown['amount_paid'])
            ->line('**Wallet Credit:** '.$breakdown['amount_paid'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->line('Your service will not be activated until the full payment is completed.');
    }
}
