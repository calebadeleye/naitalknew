<?php

namespace App\Services\Domains\Registrars;

use Illuminate\Support\Str;

/**
 * Normalizes a registrar-reported domain name before it's ever matched
 * against or written to the domains table: lowercase, strip a leading
 * protocol/scheme, strip any path, trim whitespace, and drop a trailing dot
 * (a technically-valid FQDN form registrars sometimes return).
 */
class DomainNameNormalizer
{
    public static function normalize(string $domain): string
    {
        $domain = Str::of($domain)->trim()->lower();
        $domain = $domain->contains('://') ? $domain->after('://') : $domain;
        $domain = $domain->before('/');
        $domain = rtrim($domain->toString(), '.');

        return $domain;
    }

    public static function extractTld(string $domain): string
    {
        $parts = explode('.', $domain);
        array_shift($parts);

        return '.'.implode('.', $parts);
    }
}
