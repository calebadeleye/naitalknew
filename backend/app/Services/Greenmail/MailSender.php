<?php

namespace App\Services\Greenmail;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;

/**
 * Sends as the signed-in mailbox through the mail server's own SMTP (the
 * mailbox's credentials, so SPF/DKIM and rate limits apply as for any mail
 * client) and returns the exact message, so a copy can go into Sent.
 */
class MailSender
{
    /**
     * @param  array{to: array<int, string>, cc?: array<int, string>, bcc?: array<int, string>, subject: string, html: string, text?: ?string, in_reply_to?: ?string, references?: ?string, headers?: array<string, string>}  $data
     * @param  array<int, UploadedFile>  $attachments  files uploaded from the browser
     * @param  array<int, array{name: string, mime: string, content: string}>  $forwarded  files carried over from a forwarded message
     * @return string the raw RFC 822 message as sent
     */
    public function send(string $fromEmail, ?string $fromName, string $password, array $data, array $attachments = [], array $forwarded = []): string
    {
        $message = $this->build($fromEmail, $fromName, $data, $attachments, $forwarded);
        $raw = $message->toString();

        $this->transmit($message, null, $fromEmail, $password);

        return $raw;
    }

    /**
     * Send a message composed earlier (Send later). Its Date becomes now, so
     * it sorts as just sent in the recipient's inbox.
     *
     * @param  array<int, string>  $recipients  every To, Cc and Bcc address
     * @return string the message as sent
     */
    public function sendRaw(string $raw, string $fromEmail, array $recipients, string $password): string
    {
        [$head, $body] = array_pad(preg_split("/\r?\n\r?\n/", $raw, 2), 2, '');
        $head = (string) preg_replace('/^Date:.*$/mi', 'Date: '.now()->toRfc2822String(), $head, 1);
        $raw = $head."\r\n\r\n".$body;

        $this->transmit(new RawMessage($raw), new Envelope(new Address($fromEmail), array_map(fn (string $email) => new Address($email), $recipients)), $fromEmail, $password);

        return $raw;
    }

    /** The same message, for saving as a draft instead of sending. */
    public function compose(string $fromEmail, ?string $fromName, array $data, array $attachments = [], array $forwarded = []): string
    {
        return $this->build($fromEmail, $fromName, $data, $attachments, $forwarded)->toString();
    }

    /** The one place mail leaves (tests replace it). */
    protected function transmit(RawMessage $message, ?Envelope $envelope, string $username, string $password): void
    {
        $config = config('greenmail.smtp');
        $transport = new EsmtpTransport($config['host'], $config['port'], false);
        $transport->setUsername($username);
        $transport->setPassword($password);

        if (! $config['verify_peer']) {
            // Loopback to our own Postfix, whose certificate is for mail.naitalk.com.
            $transport->getStream()->setStreamOptions(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]]);
        }

        (new Mailer($transport))->send($message, $envelope);
    }

    private function build(string $fromEmail, ?string $fromName, array $data, array $attachments, array $forwarded = []): Email
    {
        $domain = Str::after($fromEmail, '@');
        $message = (new Email)
            ->from(new Address($fromEmail, (string) $fromName))
            ->subject($data['subject'] ?: '(no subject)')
            ->html($data['html'])
            ->text($data['text'] ?? trim(html_entity_decode(strip_tags((string) preg_replace('/<br\s*\/?>|<\/p>/i', "\n", $data['html'])))));

        // Empty fields arrive as null (Laravel's ConvertEmptyStringsToNull) —
        // a draft may have no recipients yet.
        if (! empty($data['to'])) {
            $message->to(...$data['to']);
        }

        if (! empty($data['cc'])) {
            $message->cc(...$data['cc']);
        }

        if (! empty($data['bcc'])) {
            $message->bcc(...$data['bcc']);
        }

        $headers = $message->getHeaders();
        $headers->addIdHeader('Message-ID', Str::uuid()->toString().'@'.$domain);
        $headers->addTextHeader('X-Mailer', 'Greenmail (NAI TALK)');

        foreach ($data['headers'] ?? [] as $name => $value) {
            $headers->addTextHeader($name, $value);
        }

        if (! empty($data['in_reply_to'])) {
            $headers->addTextHeader('In-Reply-To', $data['in_reply_to']);
            $headers->addTextHeader('References', trim(($data['references'] ?? '').' '.$data['in_reply_to']));
        }

        foreach ($forwarded as $file) {
            $message->attach($file['content'], $file['name'], $file['mime'] ?: 'application/octet-stream');
        }

        foreach ($attachments as $file) {
            $message->attachFromPath($file->getRealPath(), $file->getClientOriginalName(), $file->getMimeType() ?: 'application/octet-stream');
        }

        return $message;
    }
}
