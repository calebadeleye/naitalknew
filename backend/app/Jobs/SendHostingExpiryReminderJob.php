<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\NotificationLog;
use App\Notifications\HostingFinalDeletionWarning;
use App\Notifications\HostingRenewalReminder;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily sweep for two kinds of scheduled reminders:
 *  - renewal reminders before a still-active service's renews_at date
 *  - final warnings before a suspended service is deleted from ISPConfig
 *
 * Dedupes against NotificationLog so re-running this job never double-sends
 * the same day's reminder.
 */
class SendHostingExpiryReminderJob implements ShouldQueue
{
    use Queueable;

    public function handle(ClientNotifier $notifier): void
    {
        foreach (config('hosting_lifecycle.reminder_days_before_expiry') as $days) {
            $this->sendRenewalReminders((int) $days, $notifier);
        }

        foreach (config('hosting_lifecycle.final_warning_days_before_deletion') as $days) {
            $this->sendFinalWarnings((int) $days, $notifier);
        }
    }

    /**
     * One reminder per renewal cycle per offset (30, 7 and 0 days by default),
     * and only while that renewal is still unpaid. The template carries the
     * renewal date so next year's reminders aren't mistaken for this year's.
     */
    private function sendRenewalReminders(int $days, ClientNotifier $notifier): void
    {
        $targetDate = now()->addDays($days)->toDateString();

        HostingService::query()
            ->subjectToLifecycle()
            ->where('status', 'active')
            ->whereDate('renews_at', $targetDate)
            ->get()
            ->each(function (HostingService $service) use ($days, $targetDate, $notifier): void {
                $template = "hosting_renewal_reminder_{$days}d_{$targetDate}";

                if ($this->alreadySent($service, $template)) {
                    return;
                }

                $invoice = Invoice::query()
                    ->where('hosting_service_id', $service->id)
                    ->whereNull('order_id')
                    ->whereNotIn('status', ['cancelled', 'void'])
                    ->whereDate('due_at', $targetDate)
                    ->latest('id')
                    ->first();

                if ($invoice?->status === 'paid') {
                    return;
                }

                $notifier->notify(
                    client: $service->client,
                    notification: new HostingRenewalReminder($service, $days, $invoice),
                    template: $template,
                    subject: HostingRenewalReminder::subjectFor($service, $days),
                    service: $service,
                );
            });
    }

    private function sendFinalWarnings(int $days, ClientNotifier $notifier): void
    {
        $template = "hosting_final_warning_{$days}d";
        $targetDate = now()->addDays($days)->toDateString();

        HostingService::query()
            ->subjectToLifecycle()
            ->where('status', 'suspended')
            ->whereNotNull('scheduled_deletion_at')
            ->whereDate('scheduled_deletion_at', $targetDate)
            ->get()
            ->each(function (HostingService $service) use ($days, $template, $notifier): void {
                if ($this->alreadySent($service, $template)) {
                    return;
                }

                $invoice = Invoice::query()
                    ->where('hosting_service_id', $service->id)
                    ->where('status', '!=', 'paid')
                    ->latest()
                    ->first();

                $notifier->notify(
                    client: $service->client,
                    notification: new HostingFinalDeletionWarning($service, $days, $invoice),
                    template: $template,
                    subject: 'Final Notice: Your website hosting will be deleted soon',
                    service: $service,
                );
            });
    }

    private function alreadySent(HostingService $service, string $template): bool
    {
        return NotificationLog::query()
            ->where('hosting_service_id', $service->id)
            ->where('template', $template)
            ->where('status', 'sent')
            ->exists();
    }
}
