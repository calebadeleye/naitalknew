<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkOverpaymentCredited extends Notification implements ShouldQueue
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
            ->subject("Payment received — extra balance saved to your NAI TALK wallet")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Your invoice has been paid in full.')
            ->line('We received more than the invoice amount. Your extra balance of '.$breakdown['overpayment_amount'].' has been saved in your NAI TALK wallet and can be used for future payments.')
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Amount Paid:** '.$breakdown['amount_paid'])
            ->line('**Wallet Credit:** '.$breakdown['overpayment_amount'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->line('Your service is ready for provisioning.');
    }
}
