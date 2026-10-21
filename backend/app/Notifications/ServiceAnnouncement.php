<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A one-off announcement to clients (maintenance, security updates…), sent
 * from the server by staff. Lines are markdown; "{name}" becomes the
 * client's name.
 */
class ServiceAnnouncement extends Notification
{
    use Queueable;

    /** @param  array<int, string>  $lines */
    public function __construct(
        public readonly string $subject,
        public readonly array $lines,
        public readonly string $name = '',
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject($this->subject)
            ->greeting($this->name !== '' ? "Hi {$this->name}," : 'Hello,');

        foreach ($this->lines as $line) {
            $mail->line(str_replace('{name}', $this->name, $line));
        }

        return $mail->salutation('Thank you for trusting NAI TALK.  '."\n".'— The NAI TALK Team');
    }
}
