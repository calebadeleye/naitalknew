<?php

namespace App\Services\Domains;

/**
 * Strict domain-name format validation shared by every domain-related
 * controller (search, registration, transfer, existing-domain hosting).
 */
class DomainNameValidator
{
    public const REGEX = '/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i';

    public static function rule(): string
    {
        return 'regex:'.self::REGEX;
    }

    public static function isValid(string $domain): bool
    {
        return (bool) preg_match(self::REGEX, $domain);
    }
}
