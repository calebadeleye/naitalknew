<?php

namespace App\Jobs;

use App\Models\Domain;
use App\Models\NotificationLog;
use App\Notifications\NaiTalkDomainExpiryReminder;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily sweep sending domain expiry reminders at 30/14/7/1/0 days before
 * expiry — mirrors SendHostingExpiryReminderJob's dedup-via-NotificationLog
 * pattern so a re-run never double-sends the same day's reminder.
 */
class SendDomainExpiryReminderJob implements ShouldQueue
{
    use Queueable;

    public function handle(ClientNotifier $notifier): void
    {
        foreach (config('hosting_lifecycle.domain_expiry_reminder_days', [30, 14, 7, 1, 0]) as $days) {
            $this->sendRemindersFor((int) $days, $notifier);
        }
    }

    private function sendRemindersFor(int $days, ClientNotifier $notifier): void
    {
        $template = "domain_expiry_reminder_{$days}d";
        $targetDate = now()->addDays($days)->toDateString();

        Domain::query()
            ->whereIn('status', ['active', 'pending'])
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', $targetDate)
            ->with('client.user')
            ->get()
            ->each(function (Domain $domain) use ($days, $template, $notifier): void {
                if ($this->alreadySent($domain, $template)) {
                    return;
                }

                $client = $domain->client;

                if (! $client) {
                    return;
                }

                $notifier->notify(
                    client: $client,
                    notification: new NaiTalkDomainExpiryReminder($domain, $days),
                    template: $template,
                    subject: $days === 0
                        ? "Your domain {$domain->domain_name} expires today"
                        : "Your domain {$domain->domain_name} expires in {$days} day(s)",
                    domain: $domain->domain_name,
                );
            });
    }

    private function alreadySent(Domain $domain, string $template): bool
    {
        return NotificationLog::query()
            ->where('domain', $domain->domain_name)
            ->where('template', $template)
            ->where('status', 'sent')
            ->exists();
    }
}
