<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * Input DTO for DomainRegistrarInterface::transfer().
 *
 * @param  array<string, mixed>  $contacts
 */
final class DomainTransferData
{
    public function __construct(
        public readonly string $domainName,
        public readonly string $eppCode,
        public readonly array $contacts = [],
    ) {}
}
