<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use App\Services\Billing\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkInvoiceCreated extends Notification implements ShouldQueue
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
        $invoice = $this->invoice->loadMissing('order.items');
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/orders/'.$invoice->order->order_number;
        $breakdown = (new InvoiceBreakdown)->build($invoice);

        $message = (new MailMessage)
            ->subject("Your NAI TALK invoice {$invoice->invoice_number}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Thanks for your order. Here is a summary of your invoice.')
            ->line('**Invoice number:** '.$invoice->invoice_number)
            ->line('**Account:** '.$notifiable->name.' ('.$notifiable->email.')');

        foreach ($invoice->order?->items ?? [] as $item) {
            $message->line('- '.$item->description.': '.Money::naira($item->total_kobo));
        }

        return $message
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Due date:** '.$invoice->due_at?->toFormattedDateString())
            ->action('Pay Invoice', $payUrl)
            ->line('You can pay online with Paystack, Flutterwave, or by bank transfer, or pay later from your dashboard — your order is already saved and this invoice will be waiting for you.')
            ->line('Need help? Contact NAI TALK support at info@naitalk.com.');
    }
}
