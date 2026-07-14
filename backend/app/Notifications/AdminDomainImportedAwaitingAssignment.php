<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admins once per sync run (not once per domain, to avoid a
 * notification storm on a large first import) whenever the Cloudflare
 * registrar sync creates one or more unassigned/needs_review domains.
 */
class AdminDomainImportedAwaitingAssignment extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $createdCount, public readonly string $provider = 'cloudflare') {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin/domain-assignments';
        $domainWord = $this->createdCount === 1 ? 'domain' : 'domains';

        return (new MailMessage)
            ->subject("{$this->createdCount} new {$this->provider} {$domainWord} awaiting assignment")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("The {$this->provider} registrar sync just imported {$this->createdCount} {$domainWord} that aren't assigned to a client yet.")
            ->line('Nothing is billed or emailed to anyone until you assign or mark them internal.')
            ->action('Review Unassigned Domains', $adminUrl);
    }
}
