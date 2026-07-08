<?php

namespace App\Notifications;

use App\Models\Payment;
use App\Services\Billing\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkPaymentProofUploaded extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Payment $payment)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payment = $this->payment->loadMissing(['client.user', 'invoice']);
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin?section=payments';

        return (new MailMessage)
            ->subject("Proof of payment uploaded for {$payment->invoice?->invoice_number}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('A client has uploaded proof of a bank transfer and it is awaiting your review.')
            ->line('**Invoice number:** '.$payment->invoice?->invoice_number)
            ->line('**Client:** '.($payment->client?->user?->name ?: 'Unknown').' ('.($payment->client?->user?->email ?: 'no email').')')
            ->line('**Amount:** '.Money::naira($payment->amount_kobo))
            ->action('Review Payment', $adminUrl)
            ->line('You can approve or reject this payment from the Payments tab in the admin panel.');
    }
}
