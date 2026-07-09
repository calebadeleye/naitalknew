<?php

namespace App\Notifications;

use App\Models\HostingService;
use App\Models\Invoice;
use App\Services\Billing\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HostingFinalDeletionWarning extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly HostingService $service,
        public readonly int $daysBeforeDeletion,
        public readonly ?Invoice $invoice = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $plural = $this->daysBeforeDeletion === 1 ? 'day' : 'days';
        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/dashboard';

        $message = (new MailMessage)
            ->subject('Final Notice: Your website hosting will be deleted soon')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('**Domain:** '.($this->service->primary_domain ?: $this->service->service_number))
            ->line('Your hosting has expired and the one-month grace period is almost over.')
            ->line("Unless payment is made, this website will be permanently removed from our hosting server in {$this->daysBeforeDeletion} {$plural}.")
            ->line('**Scheduled deletion date:** '.($this->service->scheduled_deletion_at?->toFormattedDateString() ?? 'soon'));

        if ($this->invoice) {
            $message->line('**Amount due:** '.Money::naira($this->invoice->total_kobo - $this->invoice->amount_paid_kobo));
        }

        return $message
            ->action('Pay Now', $payUrl)
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
