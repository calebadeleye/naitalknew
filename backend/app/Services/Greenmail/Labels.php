<?php

namespace App\Services\Greenmail;

use Illuminate\Support\Str;

/**
 * The business labels a mailbox can put on an email — Invoice, Quotation,
 * Customer request. Stored as IMAP keywords on the mail server, so they
 * follow the email into other mail apps that show keywords.
 */
final class Labels
{
    /** key (used by the app) => IMAP keyword (an atom: no spaces) */
    public const KEYWORDS = [
        'invoice' => 'Invoice',
        'quotation' => 'Quotation',
        'request' => 'CustomerRequest',
    ];

    /** Keywords the IMAP library must keep when it reads an email's flags (it drops unknown ones). */
    public static function imapFlagNames(): array
    {
        return array_map('strtolower', array_values(self::KEYWORDS));
    }

    /** @param  iterable<string>  $flags  flags as read from the server (any case, with or without "\") */
    public static function fromFlags(iterable $flags): array
    {
        $present = [];
        foreach ($flags as $flag) {
            $present[strtolower(ltrim((string) $flag, '\\'))] = true;
        }

        return array_values(array_filter(array_keys(self::KEYWORDS), fn (string $key) => isset($present[strtolower(self::KEYWORDS[$key])])));
    }

    public static function keyword(string $key): ?string
    {
        return self::KEYWORDS[$key] ?? null;
    }

    /**
     * A label this email probably deserves, from its subject, start of text and
     * attachment names — offered to the reader as a one-tap suggestion.
     */
    public static function suggest(string $subject, string $text = '', array $attachmentNames = []): ?string
    {
        $haystack = Str::lower($subject.' '.Str::limit($text, 1500, '').' '.implode(' ', $attachmentNames));

        return match (true) {
            (bool) preg_match('/\b(invoice|inv[-\s]?\d|proforma|pro-forma|bill(ing)? statement|payment due|amount due|receipt no)\b/', $haystack) => 'invoice',
            (bool) preg_match('/\b(quotation|quote|price list|estimate|rfq|request for quotation)\b/', $haystack) => 'quotation',
            (bool) preg_match('/\b(enquiry|inquiry|request|complaint|order|booking|help with|i would like|we would like|kindly)\b/', $haystack) => 'request',
            default => null,
        };
    }
}
