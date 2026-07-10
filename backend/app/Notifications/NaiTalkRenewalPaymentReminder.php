<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent instead of NaiTalkAutoRenewalFailed when there simply was no wallet
 * balance and no enabled saved card to charge — nothing "failed", there was
 * just nothing to attempt payment with.
 */
class NaiTalkRenewalPaymentReminder extends Notification implements ShouldQueue
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
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/orders';

        return (new MailMessage)
            ->subject('Your NAI TALK hosting renewal is due — payment needed')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Your hosting renewal is due and we could not find a wallet balance or an enabled saved card to charge automatically.')
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->action('Pay Now', $payUrl)
            ->line('Please fund your wallet or add a saved card for automatic renewals, or pay this invoice directly to keep your service active.');
    }
}
