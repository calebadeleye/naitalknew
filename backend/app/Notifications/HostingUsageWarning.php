<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent by HostingUsageAlertService when a website reaches 80% or 95% of its
 * package's storage (files + email + databases) or this month's bandwidth.
 */
class HostingUsageWarning extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param  array<string, int>  $breakdown  website_files_mb / email_mb / databases_mb, storage only */
    public function __construct(
        public readonly HostingService $service,
        public readonly string $resource,
        public readonly int $level,
        public readonly int $usedMb,
        public readonly int $quotaMb,
        public readonly array $breakdown = [],
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $domain = $this->service->primary_domain ?: $this->service->service_number;
        $manageUrl = rtrim(config('app.frontend_url'), '/').'/client/services/'.$this->service->id.'/manage';
        $isStorage = $this->resource === 'storage';
        $label = $isStorage ? 'storage space' : 'bandwidth for this month';

        $message = (new MailMessage)
            ->subject("Your website {$domain} has used {$this->level}% of its ".($isStorage ? 'storage space' : 'bandwidth'))
            ->greeting('Hi '.($notifiable->name ?? 'there').',')
            ->line("Your website **{$domain}** has used **{$this->level}%** of its {$label}: ".self::size($this->usedMb).' of '.self::size($this->quotaMb).'.');

        if ($isStorage) {
            $message->line('Your package\'s space is shared by your website files, email and databases:')
                ->line('• Website files: '.self::size($this->breakdown['website_files_mb'] ?? 0))
                ->line('• Email: '.self::size($this->breakdown['email_mb'] ?? 0))
                ->line('• Databases: '.self::size($this->breakdown['databases_mb'] ?? 0))
                ->line($this->level >= 95
                    ? 'When the space is full, new email may be rejected and your website may stop saving uploads or data. Please free up space or upgrade your plan soon.'
                    : 'To avoid problems later, consider deleting old files, emptying large mailboxes or upgrading your plan.');
        } else {
            $message->line($this->level >= 95
                ? 'If the monthly bandwidth runs out, your website may become unavailable until the next month starts. Please consider upgrading your plan.'
                : 'Bandwidth resets at the start of each month. If your website keeps getting busier, consider upgrading your plan.');
        }

        return $message
            ->action('View Usage', $manageUrl)
            ->line('Need help or a bigger plan? Reply to this email or reach us on WhatsApp at '.config('company.phone').'.');
    }

    private static function size(int $mb): string
    {
        return $mb >= 1024 ? round($mb / 1024, 1).' GB' : $mb.' MB';
    }
}
