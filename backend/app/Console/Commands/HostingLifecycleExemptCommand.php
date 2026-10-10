<?php

namespace App\Console\Commands;

use App\Models\HostingService;
use Illuminate\Console\Command;

/**
 * Marks hosting services the automatic billing lifecycle must never touch —
 * NAI TALK's own websites and complimentary hosting. An exempt service gets no
 * renewal invoices, auto-charges or expiry reminders, and is never expired,
 * suspended or deleted automatically (see HostingService::scopeSubjectToLifecycle).
 */
class HostingLifecycleExemptCommand extends Command
{
    protected $signature = 'hosting:lifecycle-exempt
        {domains* : Primary domain(s) of the hosting services}
        {--reason= : Why, e.g. "NAI TALK own website" (required unless --undo)}
        {--undo : Put the services back under the normal billing lifecycle}
        {--dry-run : Show what would change without writing anything}';

    protected $description = 'Exempt hosting services (e.g. NAI TALK\'s own sites) from automatic renewal invoices, expiry, suspension and deletion — or undo that.';

    public function handle(): int
    {
        $undo = (bool) $this->option('undo');
        $reason = trim((string) $this->option('reason'));

        if (! $undo && $reason === '') {
            $this->error('Give a --reason so the exemption is never a mystery later.');

            return self::FAILURE;
        }

        $rows = [];
        $missing = [];

        foreach ($this->argument('domains') as $domain) {
            $services = HostingService::query()->where('primary_domain', strtolower(trim($domain)))->get();

            if ($services->isEmpty()) {
                $missing[] = $domain;

                continue;
            }

            foreach ($services as $service) {
                if (! $this->option('dry-run')) {
                    $service->forceFill([
                        'lifecycle_exempt' => ! $undo,
                        'lifecycle_exempt_reason' => $undo ? null : $reason,
                    ])->save();
                }

                $rows[] = ["#{$service->id}", $service->primary_domain, $service->status, $service->renews_at?->toDateString() ?? '—', $undo ? 'back under the lifecycle' : "exempt ({$reason})"];
            }
        }

        if ($rows !== []) {
            $this->table(['Service', 'Domain', 'Status', 'Renews', $this->option('dry-run') ? 'Would become' : 'Now'], $rows);
        }

        if ($missing !== []) {
            $this->error('No hosting service with primary domain: '.implode(', ', $missing));

            return self::FAILURE;
        }

        if ($this->option('dry-run')) {
            $this->comment('Dry run — nothing was written.');
        }

        return self::SUCCESS;
    }
}
