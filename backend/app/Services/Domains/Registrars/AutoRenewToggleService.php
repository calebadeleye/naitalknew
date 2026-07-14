<?php

namespace App\Services\Domains\Registrars;

use App\Jobs\SyncCloudflareDomainJob;
use App\Models\Domain;

/**
 * Shared by the client and admin auto-renew toggle endpoints. Spaceship
 * domains keep today's exact behavior (immediate local flip, no live
 * call — this was never wired to a registrar call before this feature and
 * isn't required to change). Cloudflare domains go through the registrar
 * first and only reflect the change locally once a follow-up sync confirms
 * it — never silently/optimistically flipped.
 */
class AutoRenewToggleService
{
    public function __construct(private readonly RegistrarResolver $registrars) {}

    /**
     * @return array{pending: bool}
     */
    public function toggle(Domain $domain, bool $enabled): array
    {
        if ($domain->provider !== 'cloudflare') {
            $domain->forceFill(['auto_renew' => $enabled])->save();

            return ['pending' => false];
        }

        $this->registrars->resolve($domain)->setAutoRenew($domain->domain_name, $enabled);
        SyncCloudflareDomainJob::dispatch($domain);

        return ['pending' => true];
    }
}
