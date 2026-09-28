<?php

namespace App\Services\Ssl;

/**
 * Test double: reports a domain as having working SSL only once the test
 * has explicitly said so, without ever touching the network.
 */
class FakeCertificateChecker extends LiveCertificateChecker
{
    /** @var array<string, bool> */
    private array $activeDomains = [];

    public function markActive(string $domain): void
    {
        $this->activeDomains[strtolower($domain)] = true;
    }

    public function markInactive(string $domain): void
    {
        unset($this->activeDomains[strtolower($domain)]);
    }

    public function isActive(string $domain, int $timeoutSeconds = 4): bool
    {
        return $this->activeDomains[strtolower($domain)] ?? false;
    }
}
