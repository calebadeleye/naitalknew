<?php

namespace App\Notifications;

use App\Models\HostingService;
use App\Models\Invoice;
use App\Services\Billing\Money;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Renewal reminder for a hosting service whose renewal is still unpaid —
 * sent 30 days and 7 days before the renewal date and on the day itself
 * (the renewal invoice email two months before is the first notice). When
 * the renewal invoice exists, the reminder shows what's owed and links
 * straight to paying it.
 */
class HostingRenewalReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly HostingService $service,
        public readonly int $daysBeforeExpiry,
        public readonly ?Invoice $invoice = null,
    ) {
    }

    public static function subjectFor(HostingService $service, int $daysBeforeExpiry): string
    {
        $domain = $service->primary_domain ?: $service->service_number;

        return match (true) {
            $daysBeforeExpiry <= 0 => "Your hosting for {$domain} expires today",
            $daysBeforeExpiry === 1 => "Your hosting for {$domain} expires tomorrow",
            $daysBeforeExpiry <= 7 => "Your hosting for {$domain} expires in {$daysBeforeExpiry} days",
            default => "Your hosting for {$domain} is due for renewal in {$daysBeforeExpiry} days",
        };
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontend = rtrim(config('app.frontend_url'), '/');
        $payUrl = $this->invoice
            ? $frontend.'/client/invoices/'.$this->invoice->invoice_number
            : $frontend.'/client/dashboard';
        $domain = $this->service->primary_domain ?: $this->service->service_number;
        $renewalDate = $this->service->renews_at?->toFormattedDateString() ?? 'soon';

        $message = (new MailMessage)
            ->subject(self::subjectFor($this->service, $this->daysBeforeExpiry))
            ->greeting('Hi '.($notifiable->name ?? 'there').',')
            ->line($this->daysBeforeExpiry <= 0
                ? "Your hosting for **{$domain}** expires **today** and hasn't been renewed yet."
                : "Your hosting for **{$domain}** is due for renewal on **{$renewalDate}** and hasn't been paid yet.")
            ->line('**Plan:** '.($this->service->hostingPlan?->name ?? 'Hosting'));

        if ($this->invoice) {
            $outstanding = (int) ($this->invoice->outstanding_amount_kobo ?: ($this->invoice->total_kobo - $this->invoice->amount_paid_kobo));
            $message->line('**Invoice:** '.$this->invoice->invoice_number)
                ->line('**Amount due:** '.Money::naira($outstanding));
        }

        $message->line($this->daysBeforeExpiry <= 0
            ? 'Please renew today to keep your website and email online. If it isn\'t renewed, it will be suspended after the grace period.'
            : 'Renew before the due date to keep your website and email running without interruption. You can pay by card, bank transfer or your NAI TALK wallet.');

        return $message
            ->action($this->invoice ? 'Pay Renewal Invoice' : 'Renew Now', $payUrl)
            ->line('If you\'ve already paid, thank you — please ignore this reminder.')
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
