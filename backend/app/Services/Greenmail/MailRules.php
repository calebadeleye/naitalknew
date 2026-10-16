<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailRule;
use Carbon\CarbonImmutable;

/**
 * Turns the mailbox's filters and automation rules into Sieve, kept in one
 * marked block of ISPConfig's custom_mailfilter. ISPConfig puts that in the
 * script Dovecot runs before delivery, so the rules work even when Green Mail
 * isn't open. Anything outside our block (rules added in ISPConfig) is kept.
 *
 * Order inside the block: delete (and stop), forward copies, read/star flags,
 * one auto-reply (the first that matches), then one move (the first that
 * matches). Mail marked as spam is left alone.
 */
class MailRules
{
    public const BEGIN = '### BEGIN GREENMAIL-RULES';

    public const END = '### END GREENMAIL-RULES';

    private const NOT_SPAM = 'not anyof (header :is ["X-Spam", "X-Spam-Flag"] "Yes", header :matches "X-Spam-Status" "Yes, *")';

    public function __construct(private readonly ServerMailbox $server)
    {
    }

    /** Rewrite the mailbox's rule block from what's saved now. */
    public function sync(string $owner): void
    {
        $this->server->modify($owner, function (array $record) use ($owner) {
            $current = (string) ($record['custom_mailfilter'] ?? '');
            $next = self::replaceBlock($current, $this->compile($owner, Vacation::window($record)));

            return $next === $current ? [] : ['custom_mailfilter' => $next];
        });
    }

    /**
     * @param  array{0: CarbonImmutable, 1: CarbonImmutable}|null  $vacation  in the server's time zone; while the vacation reply is on, auto-reply rules stay quiet (one reply per message)
     */
    public function compile(string $owner, ?array $vacation = null): string
    {
        $rules = GreenmailRule::query()->where('owner_email', $owner)->where('active', true)->orderBy('position')->orderBy('id')->get();

        if ($rules->isEmpty()) {
            return '';
        }

        $byAction = $rules->groupBy('action');
        $body = [];

        foreach ($byAction->get('delete', collect()) as $rule) {
            $body[] = "if {$this->condition($rule)} {\n  discard;\n  stop;\n}";
        }

        foreach ($byAction->get('forward', collect()) as $rule) {
            $body[] = "if {$this->condition($rule)} {\n  redirect :copy {$this->quote($rule->target)};\n}";
        }

        foreach (['mark_read' => '\\Seen', 'star' => '\\Flagged'] as $action => $flag) {
            foreach ($byAction->get($action, collect()) as $rule) {
                $body[] = "if {$this->condition($rule)} {\n  addflag {$this->quote($flag)};\n}";
            }
        }

        $replies = $byAction->get('auto_reply', collect());
        if ($replies->isNotEmpty()) {
            $chain = $this->chain($replies, fn (GreenmailRule $rule) => 'vacation :days 1 :subject '.$this->quote($rule->reply_subject ?: 'Re: your email')
                .' :addresses ['.$this->quote($owner).'] '.$this->quote((string) $rule->reply_text, multiline: true).';');

            if ($vacation) {
                [$from, $until] = $vacation;
                $chain = 'if not allof (currentdate :value "ge" "iso8601" '.$this->quote($from->format('Y-m-d\TH:i:s')).', currentdate :value "le" "iso8601" '.$this->quote($until->format('Y-m-d\TH:i:s')).") {\n{$chain}\n}";
            }

            $body[] = $chain;
        }

        $moves = $byAction->get('move', collect());
        if ($moves->isNotEmpty()) {
            $body[] = $this->chain($moves, fn (GreenmailRule $rule) => 'fileinto :create '.$this->quote($rule->target).';');
        }

        return implode("\n", [
            self::BEGIN,
            '# Managed by Green Mail (Filters and Automation) for '.$this->singleLine($owner).'. Edits here are replaced.',
            'if '.self::NOT_SPAM.' {',
            // Not indented: an auto-reply's text spans lines, and indenting would change it.
            implode("\n", $body),
            '}',
            self::END,
        ]);
    }

    /** Put $block in place of our old block (or at the end), leaving the rest as it was. */
    public static function replaceBlock(string $existing, string $block): string
    {
        $pattern = '/\R?'.preg_quote(self::BEGIN, '/').'.*?'.preg_quote(self::END, '/').'\R?/s';
        $rest = trim((string) preg_replace($pattern, "\n", $existing));

        return trim($rest === '' ? $block : ($block === '' ? $rest : $rest."\n".$block));
    }

    /** "if A { … } elsif B { … }" — only the first matching rule acts. */
    private function chain($rules, callable $action): string
    {
        $parts = [];
        foreach ($rules->values() as $i => $rule) {
            $parts[] = ($i === 0 ? 'if ' : 'elsif ').$this->condition($rule)." {\n  ".$action($rule)."\n}";
        }

        return implode(' ', $parts);
    }

    private function condition(GreenmailRule $rule): string
    {
        if ($rule->field === 'any' || blank($rule->value)) {
            return 'true';
        }

        $headers = match ($rule->field) {
            'from' => '["from", "sender"]',
            'to' => '["to", "cc"]',
            default => '"subject"',
        };
        $value = $this->singleLine((string) $rule->value);

        // An exact address is compared as an address, so "Ada <ada@x.com>" matches "ada@x.com".
        if ($rule->operator === 'is' && in_array($rule->field, ['from', 'to'], true) && str_contains($value, '@')) {
            return "address :is {$headers} {$this->quote($value)}";
        }

        return match ($rule->operator) {
            'is' => "header :is {$headers} {$this->quote($value)}",
            'begins' => "header :matches {$headers} {$this->quote($this->wildcardSafe($value).'*')}",
            'ends' => "header :matches {$headers} {$this->quote('*'.$this->wildcardSafe($value))}",
            default => "header :contains {$headers} {$this->quote($value)}",
        };
    }

    /** A Sieve quoted string. */
    private function quote(?string $value, bool $multiline = false): string
    {
        $value = $multiline ? str_replace("\r\n", "\n", (string) $value) : $this->singleLine((string) $value);

        return '"'.str_replace(['\\', '"'], ['\\\\', '\\"'], $value).'"';
    }

    /** :matches treats * and ? as wildcards; typed ones are meant literally. */
    private function wildcardSafe(string $value): string
    {
        return str_replace(['\\', '*', '?'], ['\\\\', '\\*', '\\?'], $value);
    }

    private function singleLine(string $value): string
    {
        return trim((string) preg_replace('/[\x00-\x1F\x7F]+/', ' ', $value));
    }
}
