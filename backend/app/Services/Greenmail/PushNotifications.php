<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailPushSubscription;
use App\Models\Greenmail\GreenmailSession;
use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * "You've got mail" on the phone or computer, even when Green Mail is closed
 * (Web Push). A device signs up from Settings; every minute the scheduler
 * (greenmail:push-check) looks for new Inbox mail in each signed-up mailbox
 * and pushes a notification for anything newer than it last saw.
 */
class PushNotifications
{
    public function __construct(private readonly MailGateway $mail) {}

    public static function configured(): bool
    {
        return filled(config('greenmail.vapid.public_key')) && filled(config('greenmail.vapid.private_key'));
    }

    /**
     * @param  array{endpoint: string, keys: array{p256dh: string, auth: string}, domain?: ?string}  $data
     */
    public function subscribe(GreenmailSession $session, array $data, int $latestUid): GreenmailPushSubscription
    {
        $hash = hash('sha256', $data['endpoint']);
        $existing = GreenmailPushSubscription::query()->where('endpoint_hash', $hash)->where('owner_email', $session->email)->first();

        // A mailbox can have a handful of devices; the one not used longest makes room.
        if (! $existing && GreenmailPushSubscription::query()->where('owner_email', $session->email)->count() >= (int) config('greenmail.max_push_devices')) {
            GreenmailPushSubscription::query()->where('owner_email', $session->email)->oldest('updated_at')->first()?->delete();
        }

        // The same device can get notifications for several signed-in mailboxes.
        return GreenmailPushSubscription::query()->updateOrCreate(['endpoint_hash' => $hash, 'owner_email' => $session->email], [
            'session_id' => $session->id,
            'endpoint' => $data['endpoint'],
            'public_key' => $data['keys']['p256dh'],
            'auth_token' => $data['keys']['auth'],
            'password_encrypted' => Crypt::encryptString($session->password()),
            'domain' => $data['domain'] ?? null,
            'last_uid' => $latestUid,
            'failures' => 0,
        ]);
    }

    /** A test notification to one device, so people can see notifications work. */
    public function sendTest(string $owner, string $endpoint): string
    {
        $subscription = GreenmailPushSubscription::query()->where('owner_email', $owner)->where('endpoint_hash', hash('sha256', $endpoint))->first();

        if (! $subscription) {
            return 'missing';
        }

        $domain = $subscription->domain ?: Str::after($owner, '@');
        $outcome = $this->deliver([[
            'subscription' => $subscription,
            'payload' => [
                'title' => 'Green Mail notifications are on',
                'body' => "You'll get a notification like this when new mail arrives.",
                'mailbox' => $owner,
                'uid' => 0,
                'url' => '/greenmail?domain='.rawurlencode($domain).'&source=push',
                'tag' => 'greenmail-test',
                'test' => true,
            ],
        ]])[$subscription->endpoint] ?? 'failed';

        if ($outcome === 'expired') {
            $subscription->delete();
        }

        return $outcome;
    }

    /**
     * One notification to every device of a mailbox (e.g. "No reply yet").
     *
     * @return int how many devices it reached
     */
    public function notifyOwner(string $owner, string $title, string $body, string $tag): int
    {
        if (! self::configured()) {
            return 0;
        }

        $subscriptions = GreenmailPushSubscription::query()->where('owner_email', $owner)->get();
        if ($subscriptions->isEmpty()) {
            return 0;
        }

        $outgoing = $subscriptions->map(fn (GreenmailPushSubscription $s) => ['subscription' => $s, 'payload' => [
            'title' => $title,
            'body' => Str::limit($body, 160),
            'mailbox' => $owner,
            'uid' => 0,
            'url' => '/greenmail?domain='.rawurlencode($s->domain ?: Str::after($owner, '@')).'&source=push',
            'tag' => $tag,
        ]])->all();

        $sent = 0;
        foreach ($this->deliver($outgoing) as $endpoint => $outcome) {
            if ($outcome === 'sent') {
                $sent++;
            } elseif ($outcome === 'expired') {
                $subscriptions->first(fn ($s) => $s->endpoint === $endpoint)?->delete();
            }
        }

        return $sent;
    }

    public function unsubscribe(string $owner, string $endpoint): void
    {
        GreenmailPushSubscription::query()->where('owner_email', $owner)->where('endpoint_hash', hash('sha256', $endpoint))->delete();
    }

    /**
     * Check every signed-up mailbox once and notify about new mail.
     *
     * @return array{mailboxes: int, sent: int}
     */
    public function checkAll(): array
    {
        if (! self::configured()) {
            return ['mailboxes' => 0, 'sent' => 0];
        }

        $sent = 0;
        $groups = GreenmailPushSubscription::query()->orderBy('id')->get()->groupBy('owner_email');

        foreach ($groups as $owner => $subscriptions) {
            $sent += $this->checkMailbox((string) $owner, $subscriptions);
        }

        return ['mailboxes' => $groups->count(), 'sent' => $sent];
    }

    /** @param  Collection<int, GreenmailPushSubscription>  $subscriptions */
    private function checkMailbox(string $owner, Collection $subscriptions): int
    {
        // Devices may hold different passwords (one was signed in before a change); try each until one works.
        // (Compared decrypted: the same password encrypts differently every time.)
        $messages = null;
        $working = null;
        $passwords = $subscriptions->mapWithKeys(fn (GreenmailPushSubscription $s) => [$s->id => rescue(fn () => $s->password(), '', report: false)]);

        foreach ($passwords->unique()->filter() as $password) {
            try {
                $this->mail->open($owner, $password);
                $inbox = FolderRoles::pathFor($this->mail->folders(), 'inbox') ?? 'INBOX';
                $messages = collect($this->mail->messages($inbox, 1, 10, 'all')['messages']);
                $working = $password;
                break;
            } catch (MailAuthenticationFailed) {
                continue;
            } catch (Throwable $exception) {
                report($exception);

                return 0;
            } finally {
                rescue(fn () => $this->mail->close(), report: false);
            }
        }

        // No device's password works any more (changed elsewhere): stop until they sign in and turn it on again.
        if ($messages === null) {
            GreenmailPushSubscription::query()->whereIn('id', $subscriptions->pluck('id'))->delete();

            return 0;
        }

        $subscriptions->filter(fn ($s) => $passwords[$s->id] !== $working)->each->delete();
        $live = $subscriptions->filter(fn ($s) => $passwords[$s->id] === $working);
        $latest = (int) ($messages->max('uid') ?? 0);
        $outgoing = [];

        foreach ($live as $subscription) {
            $new = $messages->filter(fn (array $m) => $m['uid'] > $subscription->last_uid && ! $m['seen'])->sortByDesc('uid')->values();

            if ($new->isNotEmpty()) {
                $outgoing[] = ['subscription' => $subscription, 'payload' => $this->payload($owner, $new, $subscription->domain)];
            }

            if ($latest > $subscription->last_uid) {
                $subscription->forceFill(['last_uid' => $latest, 'last_notified_at' => $new->isNotEmpty() ? now() : $subscription->last_notified_at])->save();
            }
        }

        $sent = 0;

        foreach ($outgoing ? $this->deliver($outgoing) : [] as $endpoint => $outcome) {
            $subscription = $live->first(fn ($s) => $s->endpoint === $endpoint);

            if ($outcome === 'sent') {
                $sent++;
                $subscription?->forceFill(['failures' => 0])->save();
            } elseif ($outcome === 'expired') {
                // The browser unsubscribed (or the app was removed).
                $subscription?->delete();
            } elseif ($subscription) {
                $subscription->increment('failures');
                if ($subscription->failures >= 20) {
                    $subscription->delete();
                }
            }
        }

        return $sent;
    }

    /** What the notification says. Kept short: it shows on a lock screen. */
    private function payload(string $owner, Collection $new, ?string $domain): array
    {
        $latest = $new->first();
        $from = ($latest['from']['name'] ?? '') ?: ($latest['from']['email'] ?? 'Someone');
        $domain = $domain ?: Str::after($owner, '@');

        return [
            'title' => $new->count() === 1 ? $from : "{$new->count()} new emails",
            'body' => $new->count() === 1 ? Str::limit((string) $latest['subject'], 120) : "Latest from {$from}: ".Str::limit((string) $latest['subject'], 90),
            'mailbox' => $owner,
            'uid' => $latest['uid'],
            'url' => '/greenmail?domain='.rawurlencode($domain).'&source=push',
            'tag' => 'greenmail-'.$owner,
        ];
    }

    /**
     * Sends the notifications (tests replace this).
     *
     * @param  array<int, array{subscription: GreenmailPushSubscription, payload: array}>  $outgoing
     * @return array<string, string> endpoint => sent | expired | failed
     */
    protected function deliver(array $outgoing): array
    {
        $webPush = new WebPush(['VAPID' => [
            'subject' => config('greenmail.vapid.subject'),
            'publicKey' => config('greenmail.vapid.public_key'),
            'privateKey' => config('greenmail.vapid.private_key'),
        ]], ['TTL' => 3600], 10);

        foreach ($outgoing as $item) {
            $s = $item['subscription'];
            $webPush->queueNotification(
                Subscription::create(['endpoint' => $s->endpoint, 'publicKey' => $s->public_key, 'authToken' => $s->auth_token, 'contentEncoding' => 'aes128gcm']),
                json_encode($item['payload']),
                ['TTL' => 3600, 'urgency' => 'high', 'topic' => substr(hash('sha1', (string) $item['payload']['mailbox']), 0, 32)],
            );
        }

        $results = [];
        foreach ($webPush->flush() as $report) {
            $results[$report->getEndpoint()] = $report->isSuccess() ? 'sent' : ($report->isSubscriptionExpired() ? 'expired' : 'failed');
        }

        return $results;
    }
}
