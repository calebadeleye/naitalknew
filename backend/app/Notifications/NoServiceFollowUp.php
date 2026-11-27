<?php

namespace App\Notifications;

use App\Models\Client;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A one-off check-in for people who created an account but never set up a
 * service. Sent by hand with `clients:no-service-email`, never automatically.
 */
class NoServiceFollowUp extends Notification
{
    use Queueable;

    public function __construct(public readonly Client $client)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $company = trim((string) $this->client->company_name) ?: 'your business';
        $site = 'https://www.naitalk.com';

        return (new MailMessage)
            ->subject("Let's get {$company} online")
            ->replyTo('info@naitalk.com', 'NAI TALK')
            ->greeting(self::greetingFor((string) ($this->client->user?->name ?? '')))
            ->line('Thank you for creating an account with NAI TALK. We noticed you haven’t set up a service yet, so we wanted to check in and make getting started easy.')
            ->line("Here’s what we can do for {$company}:")
            ->line("**[Website hosting and care]({$site}/web-hosting):** we host, secure and back up your website, with SSL included. Plans from ₦25,000 a year.")
            ->line("**[Business email]({$site}/business-email-hosting):** professional addresses like you@yourcompany.com, from ₦12,000 a year.")
            ->line("**[Domain names]({$site}/domain-registration):** register a .com, .ng or .com.ng name, or transfer one you already own.")
            ->line("**[Website design]({$site}/website-design):** we design and build your website, then keep it running for you.")
            ->line('Not sure what you need? Reply to this email or call/WhatsApp us on **0708 705 7654**, and we’ll recommend the right setup for your business, free of charge.')
            ->action('Sign in to your account', "{$site}/client/login")
            ->salutation("Thank you,  \nThe NAI TALK team  \ninfo@naitalk.com · 0708 705 7654 · www.naitalk.com");
    }

    /** "Hello Theodore," when the first name looks like a real name, otherwise just "Hello,". */
    public static function greetingFor(string $name): string
    {
        $first = trim(explode(' ', trim($name))[0] ?? '');

        return mb_strlen($first) >= 3 && preg_match('/^\p{Lu}[\p{Ll}\'-]+$/u', $first) && preg_match('/[aeiou]/i', $first)
            ? "Hello {$first},"
            : 'Hello,';
    }
}
