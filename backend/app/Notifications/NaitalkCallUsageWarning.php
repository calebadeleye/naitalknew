<?php

namespace App\Notifications;

use App\Models\NaitalkCallTenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent by NaitalkCallUsageAlerts at 80% and 100% of a plan's monthly participant-minutes. */
class NaitalkCallUsageWarning extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly NaitalkCallTenant $tenant,
        public readonly string $planName,
        public readonly int $level,
        public readonly int $usedMinutes,
        public readonly int $includedMinutes,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $dashboardUrl = rtrim(config('app.frontend_url'), '/').'/client/naitalk-call';
        $used = number_format($this->usedMinutes);
        $included = number_format($this->includedMinutes);

        return (new MailMessage)
            ->subject("Naitalk Call: {$this->tenant->business_name} has used {$this->level}% of this month's minutes")
            ->greeting('Hi '.($notifiable->name ?? 'there').',')
            ->line("**{$this->tenant->business_name}** has used **{$used} of {$included}** participant-minutes on the {$this->planName} plan this month ({$this->level}%).")
            ->line($this->level >= 100
                ? 'Calls keep working, but you are now over your plan\'s allowance. To keep within your plan, move up to a bigger one.'
                : 'Calls keep working. If your app stays this busy, you may go over before the month ends; a bigger plan gives you more minutes.')
            ->line('Your allowance resets on the 1st of each month.')
            ->action('View usage', $dashboardUrl)
            ->line('Questions or a plan change? Reply to this email or reach us on WhatsApp at '.config('company.phone').'.');
    }
}
