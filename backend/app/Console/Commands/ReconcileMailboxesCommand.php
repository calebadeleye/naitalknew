<?php

namespace App\Console\Commands;

use App\Services\Ispconfig\MailboxReconciler;
use Illuminate\Console\Command;

class ReconcileMailboxesCommand extends Command
{
    protected $signature = 'mailboxes:reconcile {--dry-run : Show what would change without changing anything}';

    protected $description = 'Put every mailbox on its own domain\'s hosting service, and add mailboxes that exist only in ISPConfig';

    public function handle(MailboxReconciler $reconciler): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $report = $reconciler->run($dryRun);
        $prefix = $dryRun ? '[dry run] ' : '';

        foreach (['moved' => 'Moved to their own service', 'imported' => 'Added from ISPConfig', 'domains_moved' => 'Mail domains moved', 'unmatched' => 'No single service for the domain (left alone)'] as $key => $label) {
            $rows = collect($report[$key])->map(fn (int $count, string $domain) => "{$domain} ×{$count}")->implode(', ');
            $this->line($prefix.$label.': '.($rows ?: 'none'));
        }

        return self::SUCCESS;
    }
}
