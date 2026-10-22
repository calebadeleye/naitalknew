<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailExpoPushToken;
use App\Models\Greenmail\GreenmailSession;
use App\Services\Greenmail\Exceptions\MailAuthenticationFailed;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * "You've got mail" on phones with the Green Mail app (Expo push service).
 * Works like the Web Push side (PushNotifications): every minute the
 * scheduler (greenmail:expo-push-check) looks for new Inbox mail in each
 * signed-up mailbox and notifies about anything newer than it last saw.
 */
class ExpoPushNotifications
{
    public const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    public function __construct(private readonly MailGateway $mail) {}

    public function register(GreenmailSession $session, string $token, ?string $platform, int $latestUid): GreenmailExpoPushToken
    {
        $existing = GreenmailExpoPushToken::query()->where('token', $token)->where('owner_email', $session->email)->first();

        if (! $existing && GreenmailExpoPushToken::query()->where('owner_email', $session->email)->count() >= (int) config('greenmail.max_push_devices', 10)) {
            GreenmailExpoPushToken::query()->where('owner_email', $session->email)->oldest('updated_at')->first()?->delete();
        }

        return GreenmailExpoPushToken::query()->updateOrCreate(['token' => $token, 'owner_email' => $session->email], [
            'session_id' => $session->id,
            'platform' => $platform,
            'password_encrypted' => Crypt::encryptString($session->password()),
            // Re-registering (app restart) keeps the position, so nothing is announced twice.
            'last_uid' => $existing ? max($existing->last_uid, $latestUid) : $latestUid,
            'failures' => 0,
        ]);
    }

    public function unregister(string $owner, string $token): void
    {
        GreenmailExpoPushToken::query()->where('owner_email', $owner)->where('token', $token)->delete();
    }

    /** A test notification to one phone. Returns sent | missing | expired | failed. */
    public function sendTest(string $owner, string $token): string
    {
        $device = GreenmailExpoPushToken::query()->where('owner_email', $owner)->where('token', $token)->first();

        if (! $device) {
            return 'missing';
        }

        $outcome = $this->deliver([['device' => $device, 'payload' => [
            'title' => 'Green Mail notifications are on',
            'body' => "You'll get a notification like this when new mail arrives.",
            'data' => ['mailbox' => $owner, 'uid' => 0, 'test' => true],
        ]]])[$device->id] ?? 'failed';

        if ($outcome === 'expired') {
            $device->delete();
        }

        return $outcome;
    }

    /** @return array{mailboxes: int, sent: int} */
    public function checkAll(): array
    {
        $sent = 0;
        $groups = GreenmailExpoPushToken::query()->orderBy('id')->get()->groupBy('owner_email');

        foreach ($groups as $owner => $devices) {
            $sent += $this->checkMailbox((string) $owner, $devices);
        }

        return ['mailboxes' => $groups->count(), 'sent' => $sent];
    }

    /** @param  Collection<int, GreenmailExpoPushToken>  $devices */
    private function checkMailbox(string $owner, Collection $devices): int
    {
        // Phones may hold different passwords (one signed in before a change); try each until one works.
        $messages = null;
        $working = null;
        $passwords = $devices->mapWithKeys(fn (GreenmailExpoPushToken $d) => [$d->id => rescue(fn () => $d->password(), '', report: false)]);

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

        // No phone's password works any more: stop until they sign in again.
        if ($messages === null) {
            GreenmailExpoPushToken::query()->whereIn('id', $devices->pluck('id'))->delete();

            return 0;
        }

        $devices->filter(fn ($d) => $passwords[$d->id] !== $working)->each->delete();
        $live = $devices->filter(fn ($d) => $passwords[$d->id] === $working);
        $latest = (int) ($messages->max('uid') ?? 0);
        $outgoing = [];

        foreach ($live as $device) {
            $new = $messages->filter(fn (array $m) => $m['uid'] > $device->last_uid && ! $m['seen'])->sortByDesc('uid')->values();

            if ($new->isNotEmpty()) {
                $outgoing[] = ['device' => $device, 'payload' => $this->payload($owner, $new)];
            }

            if ($latest > $device->last_uid) {
                $device->forceFill(['last_uid' => $latest, 'last_notified_at' => $new->isNotEmpty() ? now() : $device->last_notified_at])->save();
            }
        }

        $sent = 0;

        foreach ($outgoing ? $this->deliver($outgoing) : [] as $id => $outcome) {
            $device = $live->firstWhere('id', $id);

            if ($outcome === 'sent') {
                $sent++;
                $device?->forceFill(['failures' => 0])->save();
            } elseif ($outcome === 'expired') {
                // The app was removed or notifications turned off in the phone's settings.
                $device?->delete();
            } elseif ($device) {
                $device->increment('failures');
                if ($device->failures >= 20) {
                    $device->delete();
                }
            }
        }

        return $sent;
    }

    private function payload(string $owner, Collection $new): array
    {
        $latest = $new->first();
        $from = ($latest['from']['name'] ?? '') ?: ($latest['from']['email'] ?? 'Someone');

        return [
            'title' => $new->count() === 1 ? $from : "{$new->count()} new emails",
            'body' => $new->count() === 1 ? Str::limit((string) $latest['subject'], 120) : "Latest from {$from}: ".Str::limit((string) $latest['subject'], 90),
            'data' => ['mailbox' => $owner, 'uid' => $latest['uid']],
        ];
    }

    /**
     * Sends through Expo's push API (one request, up to 100 messages).
     *
     * @param  array<int, array{device: GreenmailExpoPushToken, payload: array}>  $outgoing
     * @return array<int, string> device id => sent | expired | failed
     */
    protected function deliver(array $outgoing): array
    {
        $results = [];

        foreach (array_chunk($outgoing, 100) as $chunk) {
            $messages = array_map(fn (array $item) => $item['payload'] + [
                'to' => $item['device']->token,
                'sound' => 'default',
                'priority' => 'high',
                'channelId' => 'mail',
            ], $chunk);

            try {
                $response = Http::acceptJson()->asJson()->timeout(15)->post(self::ENDPOINT, $messages);
                $tickets = $response->successful() ? (array) $response->json('data', []) : [];
            } catch (Throwable $exception) {
                report($exception);
                $tickets = [];
            }

            foreach ($chunk as $i => $item) {
                $ticket = $tickets[$i] ?? null;
                $results[$item['device']->id] = match (true) {
                    ($ticket['status'] ?? null) === 'ok' => 'sent',
                    ($ticket['details']['error'] ?? null) === 'DeviceNotRegistered' => 'expired',
                    default => 'failed',
                };
            }
        }

        return $results;
    }
}
