<?php

namespace App\Jobs;

use App\Services\Domains\SpaceshipTldPricingSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Wraps SpaceshipTldPricingSyncService so a manual "Sync Prices" click never
 * blocks the admin's request, and so the scheduler can run this weekly
 * without any admin interaction (see routes/console.php).
 */
class SyncSpaceshipTldPricesJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $syncType = 'manual')
    {
    }

    public function handle(SpaceshipTldPricingSyncService $syncService): void
    {
        $syncService->sync($this->syncType);
    }
}
