<?php

namespace App\Notifications;

use App\Models\HostingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

/**
 * Sent when an email-only plan is ready (and again on request from the client
 * area): the DNS records the domain needs before mail arrives, how to sign in
 * to Green Mail and the settings for phone/desktop mail apps. The records are
 * also attached as a text file, which is easier to copy from than an email.
 */
class EmailOnlySetupInstructions extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<int, array<string, mixed>>  $records
     * @param  array<string, mixed>  $settings
     */
    public function __construct(
        public readonly HostingService $service,
        public readonly array $records,
        public readonly array $settings,
        public readonly bool $domainWithUs = false,
        public readonly ?string $ticketNumber = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $domain = $this->service->primary_domain;
        $manageUrl = rtrim((string) config('app.frontend_url'), '/').'/client/services/'.$this->service->id.'/manage?tab=setup';
        $in = $this->settings['incoming'];
        $out = $this->settings['outgoing'];

        $mail = (new MailMessage)
            ->subject("Your business email for {$domain} is ready — DNS setup inside")
            ->greeting('Hi '.$notifiable->name.',')
            ->line("Thank you for choosing NAI TALK. Your **{$this->service->hostingPlan?->name}** plan for **{$domain}** is active.");

        if ($this->domainWithUs) {
            $mail->line('**You don\'t need to do anything with DNS.** '.$domain.' is registered with us, so our team will add the records below for you'
                .($this->ticketNumber ? " — we'll update you on ticket {$this->ticketNumber}." : '.'));
        } else {
            $mail->line("**One step on your side:** email for {$domain} only reaches us once these DNS records are added where your domain's DNS is managed (your registrar or DNS provider — e.g. GoDaddy, Namecheap, Whogohost, Cloudflare). Sign in there, open the DNS settings for {$domain}, and add:");
        }

        // One HTML block (the shared mail template passes HTML through): each value
        // on its own line and allowed to wrap — a DKIM key is ~400 characters.
        $mail->line(new HtmlString($this->recordsHtml()));

        $mail->line('"@" means the domain itself — some providers want it left blank or written as '.$domain.'. DNS changes can take from a few minutes up to 24–48 hours. The records are also attached as a text file.');

        if (! $this->domainWithUs) {
            $mail->line('Moving email from another provider (e.g. Google Workspace or your old host)? Create your mailboxes first, then change the MX record — mail sent before the change keeps arriving at the old provider.');
        }

        return $mail
            ->line('**Next: create your mailboxes** in the client area (Email Accounts tab). You can see whether each record is in place on the Email setup tab.')
            ->action('Set up my email', $manageUrl)
            ->line("**Green Mail:** {$this->settings['webmail_url']} — sign in with the full email address and its password.")
            ->line("**Phone and desktop mail apps:** incoming {$in['protocol']} {$in['host']}, port {$in['port']} ({$in['security']}); outgoing {$out['protocol']} {$out['host']}, port {$out['port']} ({$out['security']}) or {$out['alternative_port']} ({$out['alternative_security']}). Username: the full email address.")
            ->line('Need a hand? Reply to this email or open a support ticket and we\'ll help you through it.')
            ->attachData($this->recordsText(), "email-dns-records-{$domain}.txt", ['mime' => 'text/plain']);
    }

    private function recordsHtml(): string
    {
        $html = '';

        foreach ($this->records as $i => $record) {
            $html .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;margin:0 0 12px;"><tr><td style="padding:12px 14px;font-size:14px;line-height:22px;">'
                .'<strong>'.($i + 1).'. '.e($record['type']).' record'.($record['required'] ? '' : ' (recommended)').'</strong><br>'
                .'Host / Name: <strong>'.e($record['host']).'</strong><br>'
                .($record['priority'] ? 'Priority: <strong>'.e((string) $record['priority']).'</strong><br>' : '')
                .'Value: <code style="display:block;margin:4px 0;padding:6px 8px;background:#f1f5f9;border-radius:6px;font-size:12px;line-height:18px;word-break:break-all;overflow-wrap:anywhere;">'.e($record['value']).'</code>'
                .'<span style="color:#64748b;font-size:12px;line-height:18px;">'.e($record['purpose']).'</span>'
                .'</td></tr></table>';
        }

        return $html;
    }

    private function recordsText(): string
    {
        $domain = $this->service->primary_domain;
        $text = "DNS records for business email on {$domain}\n".str_repeat('=', 44)."\n\n";

        foreach ($this->records as $i => $record) {
            $text .= ($i + 1).'. '.$record['type'].($record['required'] ? '' : ' (recommended)')."\n"
                ."   Host/Name: {$record['host']}\n"
                .($record['priority'] ? "   Priority:  {$record['priority']}\n" : '')
                ."   Value:     {$record['value']}\n"
                ."   Why:       {$record['purpose']}\n\n";
        }

        $in = $this->settings['incoming'];
        $out = $this->settings['outgoing'];

        return $text."Mail app settings\n-----------------\n"
            ."Incoming: {$in['protocol']} {$in['host']} port {$in['port']} ({$in['security']})\n"
            ."Outgoing: {$out['protocol']} {$out['host']} port {$out['port']} ({$out['security']}) or {$out['alternative_port']} ({$out['alternative_security']})\n"
            ."Username: your full email address\n"
            ."Green Mail: {$this->settings['webmail_url']}\n";
    }
}
