<?php

namespace App\Services\Greenmail;

use App\Models\MailboxRecord;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Public "who uses Green Mail" numbers for the marketing pages: active
 * mailboxes hosted with us and the businesses (mail domains) they belong to.
 * NAI TALK's own domain isn't counted. Read from ISPConfig (the full list —
 * not every mailbox has a local record), cached for six hours, and falls
 * back to our own records if ISPConfig can't be reached.
 */
class UsageStats
{
    public function __construct(private readonly IspConfigClient $client)
    {
    }

    /** @return array{businesses: int, mailboxes: int} */
    public function get(): array
    {
        return Cache::remember('greenmail:usage-stats', now()->addHours(6), fn () => $this->count());
    }

    /** @return array{businesses: int, mailboxes: int} */
    private function count(): array
    {
        try {
            $session = $this->client->login();
            try {
                $emails = collect($this->client->mailUserList($session, []))
                    ->filter(fn (array $user) => ($user['postfix'] ?? 'y') === 'y')
                    ->pluck('email');
            } finally {
                rescue(fn () => $this->client->logout($session), report: false);
            }
        } catch (Throwable $exception) {
            report($exception);
            $emails = MailboxRecord::query()->where('status', 'active')->pluck('email_address');
        }

        $own = strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST));
        $own = preg_replace('/^www\./', '', $own);
        $clientEmails = $emails->map(fn ($email) => strtolower((string) $email))->reject(fn ($email) => str_ends_with($email, '@'.$own));

        return [
            'businesses' => $clientEmails->map(fn ($email) => substr(strrchr($email, '@') ?: '@', 1))->filter()->unique()->count(),
            'mailboxes' => $clientEmails->count(),
        ];
    }
}
