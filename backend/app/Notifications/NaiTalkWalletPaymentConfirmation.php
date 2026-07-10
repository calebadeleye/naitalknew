<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Services\Billing\InvoiceBreakdown;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkWalletPaymentConfirmation extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Invoice $invoice, public readonly int $walletAmountAppliedKobo)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $breakdown = (new InvoiceBreakdown)->build($this->invoice);
        $applied = '₦'.number_format($this->walletAmountAppliedKobo / 100);

        return (new MailMessage)
            ->subject("Wallet payment successful — invoice {$this->invoice->invoice_number}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Your wallet payment was successful.')
            ->line('**Invoice number:** '.$this->invoice->invoice_number)
            ->line('**Subtotal:** '.$breakdown['subtotal'])
            ->line('**'.$breakdown['vat_label'].':** '.$breakdown['vat_amount'])
            ->line('**Total Payable:** '.$breakdown['total'])
            ->line('**Wallet Amount Applied:** '.$applied)
            ->line('**Amount Paid:** '.$breakdown['amount_paid'])
            ->line('**Outstanding Balance:** '.$breakdown['outstanding_amount'])
            ->line($this->invoice->status === 'paid' ? 'Your service is ready for provisioning.' : 'Please pay the remaining balance to activate your service.');
    }
}
