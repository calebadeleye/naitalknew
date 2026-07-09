<?php

namespace App\Notifications;

use App\Models\Client;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to admins whenever a client-facing lifecycle email (suspension,
 * deactivation, expiry, final warning, deletion...) fails to send, so an
 * admin can decide whether to retry it or contact the client manually.
 */
class ClientNotificationFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly Client $client,
        public readonly string $template,
        public readonly string $subject,
        public readonly ?string $failureReason,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $adminUrl = rtrim(config('app.frontend_url'), '/').'/admin/clients/'.$this->client->id;

        return (new MailMessage)
            ->subject("Client email failed to send: {$this->subject}")
            ->greeting('Hi '.$notifiable->name.',')
            ->line('A lifecycle notification email to a client failed to send.')
            ->line('**Client:** '.($this->client->company_name ?: $this->client->billing_email))
            ->line('**Email template:** '.$this->template)
            ->line('**Reason:** '.($this->failureReason ?: 'Unknown error'))
            ->action('Review Client', $adminUrl)
            ->line('You can retry the notification or contact the client manually.');
    }
}
