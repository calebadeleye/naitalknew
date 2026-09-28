<?php

namespace App\Console\Commands;

use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Services\Ispconfig\LegacyServiceMigrator;
use Illuminate\Console\Command;

/**
 * Moves every imported "Legacy Hosting + SSL" website onto a Website Care
 * package (Starter by default), applying that package's disk quota to the
 * real ISPConfig site first. Run with --dry-run to see exactly what would
 * change; sites that can't be resized safely are skipped and reported, never
 * forced.
 */
class MigrateLegacyHostingToStarterCommand extends Command
{
    protected $signature = 'hosting:migrate-legacy
        {--package=starter-website-care : Website Care package slug to move services onto}
        {--service=* : Only these hosting service ids}
        {--dry-run : Show what would change without touching ISPConfig or the database}';

    protected $description = 'Move legacy hosting services onto a Website Care package and apply its disk quota in ISPConfig';

    public function handle(LegacyServiceMigrator $migrator): int
    {
        $target = HostingPlan::query()->where('slug', $this->option('package'))->where('is_active', true)->first();

        if (! $target) {
            $this->error("No active package with slug \"{$this->option('package')}\".");

            return self::FAILURE;
        }

        $legacy = HostingPlan::query()->where('slug', 'legacy-hosting-ssl')->first();

        $services = HostingService::query()
            ->when($legacy, fn ($query) => $query->where('hosting_plan_id', $legacy->id))
            ->when($this->option('service'), fn ($query, $ids) => $query->whereIn('id', $ids))
            ->orderBy('id')
            ->get();

        $dryRun = (bool) $this->option('dry-run');
        $this->info(($dryRun ? '[dry run] ' : '')."{$services->count()} legacy service(s) → {$target->name}");

        $rows = [];
        $migrated = 0;

        foreach ($services as $service) {
            $result = $migrator->migrate($service, $target, null, 'Bulk move of legacy hosting to '.$target->name, $dryRun);
            $quota = $result['quota'];
            $migrated += in_array($result['status'], ['migrated', 'would_migrate'], true) ? 1 : 0;

            $rows[] = [
                $service->id,
                $service->primary_domain,
                $result['status'],
                $quota ? ($quota['previous_quota_mb'] === -1 ? 'unlimited' : $quota['previous_quota_mb'].' MB').' → '.$quota['new_quota_mb'].' MB' : '—',
                $quota ? $quota['used_mb'].' MB' : '—',
                $quota && $quota['repaired_website_id'] ? "re-linked to website {$quota['website_id']}" : '',
                $result['status'] === 'skipped' ? $result['message'] : '',
            ];
        }

        $this->table(['Service', 'Domain', 'Result', 'Disk quota', 'Used', 'Note', 'Reason'], $rows);
        $this->info("{$migrated} of {$services->count()} ".($dryRun ? 'would be moved.' : 'moved.'));

        if (! $dryRun && $migrated > 0) {
            // Refresh the client-dashboard usage/quota figures right away.
            SyncHostingUsageSnapshotJob::dispatchSync(null, 'package_migration');
            $this->info('Usage snapshots refreshed.');
        }

        return self::SUCCESS;
    }
}
