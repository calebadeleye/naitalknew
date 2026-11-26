<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailCampaign;
use App\Models\Greenmail\GreenmailCampaignRecipient;
use App\Models\Greenmail\GreenmailSetting;
use App\Models\Greenmail\GreenmailUnsubscribe;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

/**
 * Sends campaigns a few emails a minute (greenmail:dispatch runs every
 * minute), each to one person, within a daily limit per mailbox. People who
 * unsubscribed from this mailbox are skipped.
 */
class Campaigns
{
    public function __construct(private readonly MailSender $sender, private readonly CampaignTracking $tracking, private readonly CampaignQuota $quota)
    {
    }

    /** @return int emails sent */
    public function sendDue(): int
    {
        $sent = 0;

        GreenmailCampaign::query()->where('status', 'sending')->where('send_at', '<=', now())->orderBy('send_at')->get()
            ->each(function (GreenmailCampaign $campaign) use (&$sent) {
                $sent += $this->sendSome($campaign);
            });

        return $sent;
    }

    public const OUT_OF_EMAILS_NOTE = 'Paused: this month\'s campaign emails are used up. Buy more emails to carry on now, or it continues when the allowance resets.';

    public const HOURLY_NOTE = 'Your mailbox can send a limited number of emails an hour, so the rest go out automatically over the next few hours. You can close Green Mail.';

    /** An SMTP reply that means "not now" rather than "never" (4xx). */
    public static function isTemporary(string $error): bool
    {
        // Symfony Mailer: 'Expected response code "250" but got code "451", with message "451 4.7.1 …"'.
        if (preg_match('/got code "(\d{3})"/', $error, $m) || preg_match('/^\s*(\d{3})[\s-]/', $error, $m)) {
            return $m[1][0] === '4';
        }

        return false;
    }

    public function sendSome(GreenmailCampaign $campaign): int
    {
        try {
            $password = Crypt::decryptString((string) $campaign->password_encrypted);
        } catch (Throwable) {
            $campaign->update(['status' => 'failed', 'last_error' => 'Sign in to Green Mail again and restart the campaign.', 'password_encrypted' => null, 'finished_at' => now()]);

            return 0;
        }

        $sentSince = fn ($time) => GreenmailCampaignRecipient::query()
            ->whereHas('campaign', fn ($query) => $query->where('owner_email', $campaign->owner_email))
            ->where('status', 'sent')->where('sent_at', '>=', $time)->count();
        $leftToday = (int) config('greenmail.campaign_daily_limit') - $sentSince(now()->startOfDay());
        $leftThisHour = (int) config('greenmail.campaign_hourly_limit') - $sentSince(now()->subHour());
        $room = min((int) config('greenmail.campaign_per_minute'), $leftToday, $leftThisHour);

        if ($leftToday <= 0) {
            $campaign->update(['last_error' => 'Daily sending limit reached — the rest go out tomorrow.']);

            return 0;
        }

        if ($room <= 0) {
            $campaign->update(['last_error' => self::HOURLY_NOTE]);

            return 0;
        }

        // The plan's monthly emails and bought credits (null: no cap).
        $domain = CampaignQuota::domainOf($campaign->owner_email);
        $available = $this->quota->available($domain);
        if ($available !== null && $available <= 0) {
            $campaign->update(['last_error' => self::OUT_OF_EMAILS_NOTE]);

            return 0;
        }
        if ($available !== null) {
            $room = min($room, $available);
        }

        if (! $campaign->started_at) {
            $campaign->update(['started_at' => now()]);
        }

        $batch = $campaign->recipients()->where('status', 'pending')->orderBy('id')->limit($room)->get();
        $unsubscribed = GreenmailUnsubscribe::query()->where('owner_email', $campaign->owner_email)->whereIn('email', $batch->pluck('email'))->pluck('email')->flip();
        $fromName = GreenmailSetting::query()->where('owner_email', $campaign->owner_email)->value('display_name');
        $body = $this->tracking->prepare($campaign, $campaign->body_html);
        $sent = 0;

        foreach ($batch as $recipient) {
            if ($unsubscribed->has($recipient->email)) {
                $recipient->update(['status' => 'skipped', 'error' => 'Unsubscribed']);
                $campaign->increment('skipped_count');

                continue;
            }

            $url = $this->unsubscribeUrl($recipient);

            try {
                $this->sender->send($campaign->owner_email, $fromName, $password, [
                    'to' => [$recipient->email],
                    'subject' => $this->personalise($campaign->subject, $recipient->name, $recipient->email, html: false),
                    'html' => $this->tracking->forRecipient($this->personalise($body, $recipient->name, $recipient->email), $recipient).$this->footer($campaign->owner_email, $url),
                    'headers' => [
                        'List-Unsubscribe' => "<{$url}>",
                        'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
                        'Precedence' => 'bulk',
                    ],
                ]);
            } catch (TransportExceptionInterface $exception) {
                if (preg_match('/\b535\b|authenticat/i', $exception->getMessage())) {
                    $campaign->update(['status' => 'failed', 'last_error' => 'The mailbox password has changed. Sign in again and restart the campaign.', 'password_encrypted' => null, 'finished_at' => now()]);

                    return $sent;
                }

                // "Try again later" (4xx, e.g. 451 rate limit): this one stays waiting and
                // the campaign carries on after a pause, instead of failing everyone left.
                if (self::isTemporary($exception->getMessage())) {
                    $campaign->update(['send_at' => now()->addMinutes((int) config('greenmail.campaign_retry_minutes')), 'last_error' => self::HOURLY_NOTE]);

                    return $sent;
                }

                $recipient->update(['status' => 'failed', 'error' => Str::limit($exception->getMessage(), 250)]);
                $campaign->increment('failed_count');

                continue;
            }

            $recipient->update(['status' => 'sent', 'sent_at' => now(), 'error' => null, 'charged_to' => $this->quota->charge($domain)]);
            $campaign->increment('sent_count');
            $sent++;
        }

        if (! $campaign->recipients()->where('status', 'pending')->exists()) {
            $campaign->update(['status' => 'sent', 'finished_at' => now(), 'password_encrypted' => null, 'last_error' => null]);
        } elseif ($available !== null && $this->quota->available($domain) <= 0) {
            // More people to go, but this batch used the last of the emails.
            $campaign->update(['last_error' => self::OUT_OF_EMAILS_NOTE]);
        } elseif ($campaign->last_error) {
            $campaign->update(['last_error' => null]);
        }

        return $sent;
    }

    /** {{name}}, {{first_name}} and {{email}} — escaped for HTML unless $html is false. */
    public function personalise(string $text, ?string $name, string $email, bool $html = true): string
    {
        $name = trim((string) $name);
        $values = [
            'name' => $name !== '' ? $name : 'there',
            'first_name' => $name !== '' ? Str::before($name, ' ') : 'there',
            'email' => $email,
        ];

        return (string) preg_replace_callback('/\{\{\s*(name|first_name|email)\s*\}\}/i', function (array $match) use ($values, $html) {
            $value = $values[strtolower($match[1])];

            return $html ? e($value) : $value;
        }, $text);
    }

    public function footer(string $owner, ?string $unsubscribeUrl): string
    {
        $link = $unsubscribeUrl ? '<a href="'.e($unsubscribeUrl).'" style="color:#6b7280">Unsubscribe</a>' : '<span style="text-decoration:underline">Unsubscribe</span>';

        return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">'
            .'<p style="font-size:12px;color:#6b7280;margin:0">You received this email from '.e($owner).'. '.$link.' if you no longer want these emails.</p>';
    }

    public function unsubscribeUrl(GreenmailCampaignRecipient $recipient): string
    {
        return rtrim((string) config('app.url'), '/').'/api/v1/greenmail/unsubscribe/'.$recipient->unsubscribeToken();
    }
}
