<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent by RepairWebsiteProxiesJob about a client-run app's website:
 *  - "repaired": the proxy rule that connects the domain to the app had gone
 *    missing and was put back automatically;
 *  - "app_down": the connection is fine but the app itself isn't answering —
 *    only the client can restart it.
 */
class WebsiteConnectionAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly HostingService $service,
        public readonly string $kind,
        public readonly int $port,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public static function subjectFor(HostingService $service, string $kind): string
    {
        $domain = $service->primary_domain ?: $service->service_number;

        return $kind === 'repaired'
            ? "We restored the connection for {$domain}"
            : "Your app for {$domain} isn't responding";
    }

    public function toMail(object $notifiable): MailMessage
    {
        $domain = $this->service->primary_domain ?: $this->service->service_number;
        $manageUrl = rtrim(config('app.frontend_url'), '/').'/client/services/'.$this->service->id.'/manage?tab=website';

        $message = (new MailMessage)
            ->subject(self::subjectFor($this->service, $this->kind))
            ->greeting('Hi '.($notifiable->name ?? 'there').',');

        if ($this->kind === 'repaired') {
            $message->line("The setting that connects **{$domain}** to your application (port {$this->port}) had gone missing, so visitors weren't seeing your site.")
                ->line('We detected this and put it back automatically — your website is being served normally again. You don\'t need to do anything.');
        } else {
            $message->line("Visitors to **{$domain}** can't reach your application right now: nothing is answering on port {$this->port}.")
                ->line('The connection itself is set up correctly, so the application has most likely stopped. Please restart it (for example, run it again over SSH). Once it is running, your website comes back on its own.');
        }

        return $message
            ->action('Check Website Status', $manageUrl)
            ->line('**Support:** '.config('company.email').' / '.config('company.phone'));
    }
}
