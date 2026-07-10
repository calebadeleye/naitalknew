<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Flow 3 ("Hosting Only With Existing Domain") — sent once hosting is
 * provisioned for a domain the client already owns elsewhere. NAI TALK
 * never registers or transfers this domain; the client points it here
 * themselves using these instructions.
 */
class ExistingDomainDnsInstructions extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly HostingService $hostingService)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $hostname = config('ispconfig.public_hostname');

        return (new MailMessage)
            ->subject('Your NAI TALK hosting is ready — point your domain to activate it')
            ->greeting('Hi '.$notifiable->name.',')
            ->line('Your hosting has been activated. To point your domain to NAI TALK, update your nameservers or DNS records using the details below.')
            ->line('**Domain:** '.$this->hostingService->primary_domain)
            ->line('**Server hostname:** '.$hostname)
            ->line('**Recommended:** update your domain\'s A record to point to our server, or ask your current registrar/DNS provider to use our nameservers.')
            ->line('DNS changes can take anywhere from a few minutes to 24-48 hours to fully propagate.')
            ->line('If you are not sure how to update your DNS records, contact NAI TALK support and we will help you through it.');
    }
}
