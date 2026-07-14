<?php

namespace App\Jobs;

use App\Models\Domain;
use App\Services\Domains\Registrars\CloudflareDomainSyncApplier;
use App\Services\Domains\Registrars\CloudflareRegistrarService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Single-domain Cloudflare refresh — dispatched after a registrar-changing
 * action (auto-renew toggle, renewal) or an admin's "Refresh from
 * Cloudflare" click, so nothing in the request/response cycle ever makes a
 * synchronous Cloudflare call.
 */
class SyncCloudflareDomainJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Domain $domain) {}

    public function handle(CloudflareRegistrarService $registrar, CloudflareDomainSyncApplier $applier): void
    {
        if ($this->domain->provider !== 'cloudflare') {
            return;
        }

        $result = $registrar->getRegistration($this->domain->domain_name);

        if (! $result) {
            return;
        }

        $applier->apply($result, 'cloudflare');
    }
}
