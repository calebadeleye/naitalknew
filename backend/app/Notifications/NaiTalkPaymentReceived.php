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
        $invoiceUrl = rtrim(config('app.frontend_url'), '/').'/client/invoices/'.$this->invoice->invoice_number;
        // Only orders/renewals lead to provisioning — a standalone invoice
        // (e.g. a project fee) is simply settled.
        $provisioningNote = ($this->invoice->order_id || $this->invoice->hosting_service_id)
            ? ' Your service is ready for provisioning.'
            : '';

        return (new MailMessage)
            ->subject("Payment received — invoice {$this->invoice->invoice_number} is now paid")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('We have received your payment in full. Your invoice is now marked as paid.'.$provisioningNote)
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Amount Paid:** '.$breakdown['amount_paid'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->action('View Invoice', $invoiceUrl)
            ->line('Thank you for choosing NAI TALK.');
    }
}
