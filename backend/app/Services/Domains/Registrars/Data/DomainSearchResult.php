<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * Not wired into any checkout/search controller in this phase — exists for
 * interface completeness and future use only (see DomainRegistrarInterface's
 * class docblock).
 *
 * @param  array<int, DomainAvailabilityResult>  $suggestions
 */
final class DomainSearchResult
{
    public function __construct(
        public readonly string $domain,
        public readonly DomainAvailabilityResult $primary,
        public readonly array $suggestions = [],
    ) {}
}
