<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent by CampaignQuota when a domain has used 80% of this month's free campaign emails and has no credits. */
class GreenmailCampaignEmailsLow extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $domain,
        public readonly int $used,
        public readonly int $allowance,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $left = max(0, $this->allowance - $this->used);

        return (new MailMessage)
            ->subject("{$this->domain} has used {$this->used} of its {$this->allowance} campaign emails this month")
            ->greeting('Hi '.($notifiable->name ?? 'there').',')
            ->line("Green Mail campaigns from **{$this->domain}** have sent {$this->used} of the {$this->allowance} emails included with your plan this month. {$left} are left.")
            ->line('When they run out, campaigns pause until the allowance resets next month, or until you buy more emails. Packs start at 1,000 emails for ₦2,500 and stay valid for 12 months.')
            ->action('Open Green Mail campaigns', rtrim((string) config('app.frontend_url'), '/').'/greenmail?domain='.rawurlencode($this->domain))
            ->line('Emails that fail, people who unsubscribed and test emails are never counted.');
    }
}
