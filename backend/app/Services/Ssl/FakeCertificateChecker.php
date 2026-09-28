<?php

namespace App\Services\Ssl;

use Illuminate\Support\Carbon;

/**
 * Test double: reports a domain's certificate status only once the test has
 * explicitly said so, without ever touching the network.
 */
class FakeCertificateChecker extends LiveCertificateChecker
{
    /** @var array<string, ?Carbon> domain => expiry (null domain never marked = absent from array) */
    private array $expiresAt = [];

    /**
     * Marks the domain as having a currently-working certificate, expiring
     * 60 days out unless a specific date is given.
     */
    public function markActive(string $domain, ?Carbon $expiresAt = null): void
    {
        $this->expiresAt[strtolower($domain)] = $expiresAt ?? now()->addDays(60);
    }

    /** Marks the domain as having a certificate that has already expired. */
    public function markExpired(string $domain, ?Carbon $expiredAt = null): void
    {
        $this->expiresAt[strtolower($domain)] = $expiredAt ?? now()->subDays(5);
    }

    public function markInactive(string $domain): void
    {
        unset($this->expiresAt[strtolower($domain)]);
    }

    public function check(string $domain, int $timeoutSeconds = 4): array
    {
        $expiresAt = $this->expiresAt[strtolower($domain)] ?? null;

        return ['active' => $expiresAt !== null && $expiresAt->isFuture(), 'expires_at' => $expiresAt];
    }

    public function isActive(string $domain, int $timeoutSeconds = 4): bool
    {
        return $this->check($domain, $timeoutSeconds)['active'];
    }
}
