<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * Input DTO for DomainRegistrarInterface::register(). Not exercised by any
 * live call site in this phase (see the interface's class docblock) — exists
 * for architectural completeness so a future checkout integration doesn't
 * need another interface change.
 *
 * @param  array<string, mixed>  $contacts
 */
final class DomainRegistrationData
{
    public function __construct(
        public readonly string $domainName,
        public readonly int $years = 1,
        public readonly array $contacts = [],
        public readonly ?string $eppCode = null,
    ) {}
}
