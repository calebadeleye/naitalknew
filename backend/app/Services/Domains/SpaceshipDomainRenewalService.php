<?php

namespace App\Services\Domains;

use App\Models\Domain;
use Illuminate\Support\Carbon;

class SpaceshipDomainRenewalService
{
    public function __construct(private readonly SpaceshipClient $client)
    {
    }

    public function renew(Domain $domain, int $years = 1): void
    {
        $result = $this->client->renewDomain($domain->domain_name, $years);
        $expiresAt = $result['expirationDate'] ?? now()->addYears($years)->toIso8601String();

        $domain->forceFill([
            'status' => 'active',
            'registration_status' => 'registered',
            'expires_at' => Carbon::parse($expiresAt)->toDateString(),
        ])->save();
    }
}
