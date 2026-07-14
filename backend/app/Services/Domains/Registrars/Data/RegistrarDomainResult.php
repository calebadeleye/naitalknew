<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * The registrar's own view of a single domain — deliberately carries no
 * registrant/contact fields (privacy requirement: registrar sync must never
 * pull or store private registrant data it doesn't already have a reason to).
 *
 * @param  array<int, string>|null  $nameservers
 * @param  array<string, mixed>  $providerMetadata  Sanitized (secrets already stripped).
 */
final class RegistrarDomainResult
{
    public function __construct(
        public readonly string $providerDomainId,
        public readonly ?string $providerOrderId,
        public readonly string $domainName,
        public readonly string $tld,
        public readonly string $providerStatus,
        public readonly bool $autoRenewEnabled,
        public readonly ?\DateTimeImmutable $registeredAt = null,
        public readonly ?\DateTimeImmutable $expiresAt = null,
        public readonly ?array $nameservers = null,
        public readonly ?string $dnsStatus = null,
        public readonly ?int $providerCostMinor = null,
        public readonly ?string $providerCurrency = null,
        public readonly array $providerMetadata = [],
    ) {}
}
