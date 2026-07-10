<?php

namespace App\Notifications;

use App\Models\WalletTransaction;
use App\Services\Billing\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NaiTalkWalletFunded extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly WalletTransaction $transaction)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your NAI TALK wallet top-up was successful')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Your wallet top-up was successful.')
            ->line('**Amount Funded:** '.Money::naira($this->transaction->amount_kobo))
            ->line('**New Wallet Balance:** '.Money::naira($this->transaction->balance_after_kobo))
            ->line('You can use your wallet balance to pay any future invoice, in full or in part.');
    }
}
