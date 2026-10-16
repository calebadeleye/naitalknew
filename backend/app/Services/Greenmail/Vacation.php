<?php

namespace App\Services\Greenmail;

use Carbon\CarbonImmutable;
use Throwable;

/**
 * The out-of-office reply, using ISPConfig's own autoresponder (so it also
 * shows in the hosting panel). Dovecot sends it at most once a day per sender
 * and never to spam or mailing lists. ISPConfig stores the times in the
 * server's zone; the API speaks ISO 8601 with an offset.
 */
class Vacation
{
    /** "Until I turn it off" — ISPConfig needs an end date, so it is far away. */
    private const OPEN_ENDED_YEARS = 5;

    public function __construct(private readonly ServerMailbox $server, private readonly MailRules $rules)
    {
    }

    /** @return array{enabled: bool, subject: string, message: string, starts_at: ?string, ends_at: ?string, open_ended: bool} */
    public function get(string $email): array
    {
        return self::present($this->server->get($email));
    }

    /**
     * @param  array{enabled: bool, subject?: ?string, message?: ?string, starts_at?: ?string, ends_at?: ?string}  $data
     * @return array{enabled: bool, subject: string, message: string, starts_at: ?string, ends_at: ?string, open_ended: bool}
     */
    public function set(string $email, array $data): array
    {
        $zone = (string) config('greenmail.server_timezone');
        $start = filled($data['starts_at'] ?? null) ? CarbonImmutable::parse($data['starts_at'])->setTimezone($zone) : CarbonImmutable::now($zone)->startOfMinute();
        $end = filled($data['ends_at'] ?? null) ? CarbonImmutable::parse($data['ends_at'])->setTimezone($zone) : $start->addYears(self::OPEN_ENDED_YEARS);

        $saved = $this->server->modify($email, function (array $record) use ($data, $start, $end, $email) {
            $params = [
                'autoresponder' => $data['enabled'] ? 'y' : 'n',
                'autoresponder_subject' => self::plain($data['subject'] ?? null) ?: 'Out of office',
                'autoresponder_text' => self::plain($data['message'] ?? null, multiline: true),
                'autoresponder_start_date' => $start->format('Y-m-d H:i:s'),
                'autoresponder_end_date' => $end->format('Y-m-d H:i:s'),
            ];

            // Auto-reply rules pause while the vacation reply is on, so one email never gets two replies.
            $current = (string) ($record['custom_mailfilter'] ?? '');
            $filter = MailRules::replaceBlock($current, $this->rules->compile($email, self::window(array_merge($record, $params))));
            if ($filter !== $current) {
                $params['custom_mailfilter'] = $filter;
            }

            return $params;
        });

        return self::present($saved);
    }

    /**
     * When the vacation reply is on: [from, until] in the server's zone.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public static function window(array $record): ?array
    {
        if (($record['autoresponder'] ?? 'n') !== 'y') {
            return null;
        }

        $zone = (string) config('greenmail.server_timezone');

        try {
            $from = filled($record['autoresponder_start_date'] ?? null) ? CarbonImmutable::parse($record['autoresponder_start_date'], $zone) : CarbonImmutable::now($zone)->subYear();
            $until = filled($record['autoresponder_end_date'] ?? null) ? CarbonImmutable::parse($record['autoresponder_end_date'], $zone) : CarbonImmutable::now($zone)->addYears(self::OPEN_ENDED_YEARS);
        } catch (Throwable) {
            return null;
        }

        return $until->isPast() ? null : [$from, $until];
    }

    private static function present(array $record): array
    {
        $zone = (string) config('greenmail.server_timezone');
        $start = filled($record['autoresponder_start_date'] ?? null) ? CarbonImmutable::parse($record['autoresponder_start_date'], $zone) : null;
        $end = filled($record['autoresponder_end_date'] ?? null) ? CarbonImmutable::parse($record['autoresponder_end_date'], $zone) : null;
        $openEnded = $start && $end && $end->gt($start->addYears(self::OPEN_ENDED_YEARS - 1));

        return [
            'enabled' => ($record['autoresponder'] ?? 'n') === 'y' && (! $end || $end->isFuture()),
            'subject' => (string) ($record['autoresponder_subject'] ?? ''),
            'message' => (string) ($record['autoresponder_text'] ?? ''),
            'starts_at' => $start?->toIso8601String(),
            'ends_at' => $openEnded ? null : $end?->toIso8601String(),
            'open_ended' => (bool) $openEnded,
        ];
    }

    /**
     * Plain text for ISPConfig's Sieve template. Straight double quotes and
     * backslashes become typographic ones so the generated script stays valid
     * whatever ISPConfig does with them.
     */
    private static function plain(?string $text, bool $multiline = false): string
    {
        $text = str_replace(["\r\n", '"', '\\'], ["\n", '”', '/'], (string) $text);
        $text = $multiline ? (string) preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/', ' ', $text) : (string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $text);

        return trim(mb_substr($text, 0, $multiline ? 4000 : 200));
    }
}
