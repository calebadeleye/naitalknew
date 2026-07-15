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
        $invoice = $this->invoice->loadMissing('order');
        $payUrl = $invoice->order
            ? rtrim(config('app.frontend_url'), '/').'/client/orders/'.$invoice->order->order_number
            : rtrim(config('app.frontend_url'), '/').'/client/invoices/'.$invoice->invoice_number;
        $breakdown = (new InvoiceBreakdown)->build($invoice);

        $message = (new MailMessage)
            ->subject("Your NAI TALK invoice {$invoice->invoice_number}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line($invoice->order
                ? 'Thanks for your order. Here is a summary of your invoice.'
                : 'A new invoice has been added to your NAI TALK account. Here is a summary.')
            ->line('**Invoice number:** '.$invoice->invoice_number)
            ->line('**Account:** '.$notifiable->name.' ('.$notifiable->email.')');

        // The invoice's own line_items is the authoritative source for every
        // invoice regardless of origin (order-based creators already copy
        // the order's items into it) — reading it directly here, rather than
        // via $invoice->order->items, means this list is never empty for an
        // order-less/manual invoice.
        foreach ($invoice->line_items ?? [] as $item) {
            $message->line('- '.$item['description'].': '.Money::naira($item['total_kobo']));
        }

        return $message
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Due date:** '.$invoice->due_at?->toFormattedDateString())
            ->action('Pay Invoice', $payUrl)
            ->line('You can pay online with Paystack, Flutterwave, or by bank transfer, or pay later from your dashboard — this invoice will be waiting for you.')
            ->line('Need help? Contact NAI TALK support at info@naitalk.com.');
    }
}
