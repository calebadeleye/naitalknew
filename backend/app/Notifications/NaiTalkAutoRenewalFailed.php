<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkAutoRenewalFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Invoice $invoice, public readonly string $reason)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $breakdown = (new InvoiceBreakdown)->build($this->invoice);
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/orders';

        return (new MailMessage)
            ->subject('Action required: your NAI TALK hosting renewal payment failed')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('We were unable to automatically renew your hosting service. Your service has not been renewed and remains unpaid.')
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Amount Paid:** '.$breakdown['amount_paid'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->action('Pay Now', $payUrl)
            ->line('Please fund your wallet, add a payment method, or pay this invoice directly to keep your service active.');
    }
}
