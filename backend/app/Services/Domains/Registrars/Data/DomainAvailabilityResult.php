<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * @param  array<string, mixed>  $raw  Sanitized (secrets already stripped by the calling client).
 */
final class DomainAvailabilityResult
{
    public function __construct(
        public readonly string $domain,
        public readonly bool $available,
        public readonly bool $premium,
        public readonly bool $tldSupported,
        public readonly ?int $premiumPriceMinor = null,
        public readonly ?string $currency = null,
        public readonly array $raw = [],
    ) {}
}
