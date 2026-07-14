<?php

namespace App\Services\Domains\Registrars;

use App\Models\Domain;
use Illuminate\Support\Str;

/**
 * Maps a domain (or an explicit provider string) to its registrar
 * implementation via config('services.registrars.map'). Unrecognized or
 * null providers fall back to Spaceship, preserving today's behavior for
 * every existing domain exactly as-is.
 */
class RegistrarResolver
{
    public function resolve(Domain $domain): DomainRegistrarInterface
    {
        return $this->resolveForProvider($domain->provider);
    }

    public function resolveForProvider(?string $provider): DomainRegistrarInterface
    {
        $map = config('services.registrars.map', []);
        $default = config('services.registrars.default', 'spaceship');

        $class = $map[$provider] ?? $map[$default] ?? null;

        if (! $class) {
            throw new \RuntimeException("No registrar implementation configured for provider [{$provider}].");
        }

        return app($class);
    }

    /**
     * Encodes the Nigerian-TLD carve-out: these extensions stay manual/
     * unavailable-for-instant-registration regardless of which provider a
     * domain's own `provider` column happens to say, since no currently
     * configured registrar supports them for automated purchase. Built now
     * for architectural completeness — not wired into any checkout path in
     * this phase (new-purchase routing is out of scope; see the domain
     * search/checkout controllers, which are untouched).
     */
    public function supportsInstantRegistration(string $tld): bool
    {
        $manualOnly = config('services.registrars.manual_only_tlds', []);
        $tld = Str::lower($tld);

        return ! in_array($tld, array_map(fn (string $value) => Str::lower($value), $manualOnly), true);
    }
}
