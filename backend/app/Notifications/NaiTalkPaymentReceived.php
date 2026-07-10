<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkPaymentReceived extends Notification implements ShouldQueue
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
            ->subject("Payment received — invoice {$this->invoice->invoice_number} is now paid")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('We have received your payment in full. Your invoice is now marked as paid and your service is ready for provisioning.')
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Amount Paid:** '.$breakdown['amount_paid'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->line('Thank you for choosing NAI TALK.');
    }
}
