<?php

namespace App\Console\Commands;

use App\Models\Domain;
use App\Models\DomainSyncLog;
use App\Models\User;
use App\Notifications\AdminDomainImportedAwaitingAssignment;
use App\Notifications\AdminDomainSyncFailureRequiresAttention;
use App\Services\Domains\Registrars\CloudflareDomainSyncApplier;
use App\Services\Domains\Registrars\CloudflareRegistrarService;
use App\Services\Domains\Registrars\Data\RegistrarDomainResult;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Throwable;

/**
 * Imports/syncs Cloudflare Registrar domains into the local domains table.
 * Never guesses a customer for a newly-imported domain — those are always
 * created unassigned/needs_review for an admin to review (see
 * DomainAssignmentController). A single record failing never aborts the run;
 * a page fetch failing does.
 */
class SyncCloudflareDomainsCommand extends Command
{
    protected $signature = 'cloudflare:sync-domains {--dry-run : Show proposed changes without writing to the database} {--domain= : Sync only this single domain} {--force : Re-sync even if this domain was synced very recently}';

    protected $description = 'Import and synchronize Cloudflare Registrar domain registrations.';

    /**
     * @var array{created: int, updated: int, unchanged: int, skipped: int, failed: int}
     */
    private array $counts = ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'skipped' => 0, 'failed' => 0];

    public function handle(CloudflareRegistrarService $registrar, CloudflareDomainSyncApplier $applier): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $singleDomain = $this->option('domain');
        $force = (bool) $this->option('force');

        $syncLog = $dryRun ? null : DomainSyncLog::query()->create([
            'domain_id' => null,
            'provider' => 'cloudflare',
            'action' => $singleDomain ? 'single_sync' : 'full_sync',
            'status' => 'running',
            'request_reference' => (string) Str::uuid(),
            'started_at' => now(),
        ]);

        try {
            if ($singleDomain) {
                $this->syncSingleDomain($singleDomain, $registrar, $applier, $dryRun, $force);
            } else {
                $this->syncAllDomains($registrar, $applier, $dryRun);
            }
        } finally {
            $syncLog?->forceFill([
                'status' => $this->counts['failed'] > 0 ? 'partial' : 'success',
                'changes' => $this->counts,
                'completed_at' => now(),
            ])->save();
        }

        $this->newLine();
        $this->table(
            ['Created', 'Updated', 'Unchanged', 'Skipped', 'Failed'],
            [[$this->counts['created'], $this->counts['updated'], $this->counts['unchanged'], $this->counts['skipped'], $this->counts['failed']]],
        );

        if ($dryRun) {
            $this->info('Dry run — no changes were written to the database.');
        } elseif (! $singleDomain) {
            // Batched once per run (never per domain) to avoid a
            // notification storm on a large first import.
            $this->notifyAdmins();
        }

        return self::SUCCESS;
    }

    private function notifyAdmins(): void
    {
        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty()) {
            return;
        }

        if ($this->counts['created'] > 0) {
            Notification::send($admins, new AdminDomainImportedAwaitingAssignment($this->counts['created']));
        }

        if ($this->counts['failed'] > 0) {
            Notification::send($admins, new AdminDomainSyncFailureRequiresAttention($this->counts['failed']));
        }
    }

    private function syncSingleDomain(string $domainName, CloudflareRegistrarService $registrar, CloudflareDomainSyncApplier $applier, bool $dryRun, bool $force): void
    {
        if (! $force && ! $dryRun) {
            $recentlySynced = Domain::query()
                ->where('domain_name', $domainName)
                ->where('provider', 'cloudflare')
                ->where('last_synced_at', '>=', now()->subMinutes(5))
                ->exists();

            if ($recentlySynced) {
                $this->info("Domain {$domainName} was synced within the last 5 minutes — skipping (use --force to override).");
                $this->counts['unchanged']++;

                return;
            }
        }

        try {
            $result = $registrar->getRegistration($domainName);
        } catch (Throwable $exception) {
            $this->error("Failed to fetch {$domainName} from Cloudflare: {$exception->getMessage()}");
            $this->counts['failed']++;

            return;
        }

        if (! $result) {
            $this->error("Domain {$domainName} was not found in Cloudflare Registrar.");
            $this->counts['failed']++;

            return;
        }

        $this->applyOne($result, $applier, $dryRun);
    }

    private function syncAllDomains(CloudflareRegistrarService $registrar, CloudflareDomainSyncApplier $applier, bool $dryRun): void
    {
        $cursor = null;

        do {
            try {
                $page = $registrar->listRegistrations($cursor);
            } catch (Throwable $exception) {
                $this->error("Failed to fetch a page of Cloudflare registrations: {$exception->getMessage()}");
                $this->counts['failed']++;

                return;
            }

            foreach ($page->items as $result) {
                $this->applyOne($result, $applier, $dryRun);
            }

            $cursor = $page->nextCursor;
        } while ($page->hasMore);
    }

    private function applyOne(RegistrarDomainResult $result, CloudflareDomainSyncApplier $applier, bool $dryRun): void
    {
        try {
            $applied = $applier->apply($result, 'cloudflare', $dryRun);
        } catch (Throwable $exception) {
            $this->counts['failed']++;
            $this->error("Failed to sync {$result->domainName}: {$exception->getMessage()}");

            return;
        }

        match ($applied['action']) {
            'created' => $this->counts['created']++,
            'updated' => $this->counts['updated']++,
            'unchanged' => $this->counts['unchanged']++,
            'skipped_conflict' => $this->counts['skipped']++,
            default => null,
        };

        if ($dryRun && $applied['action'] !== 'unchanged') {
            $this->line("[{$applied['action']}] {$result->domainName}: ".json_encode($applied['changes']));
        }
    }
}
