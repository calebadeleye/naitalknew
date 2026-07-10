<?php

namespace App\Jobs;

use App\Models\DomainOrder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Admin-triggered retry for a domain order that previously failed
 * registration. Resets the order/domain back to a retryable state and
 * re-dispatches RegisterDomainWithSpaceshipJob.
 */
class RetryFailedDomainRegistrationJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $domainOrderId)
    {
    }

    public function handle(): void
    {
        $domainOrder = DomainOrder::query()->with('domain')->find($this->domainOrderId);

        if (! $domainOrder || $domainOrder->status !== 'failed') {
            return;
        }

        $domainOrder->forceFill(['status' => 'pending_payment', 'error_message' => null])->save();
        $domainOrder->domain?->forceFill(['registration_status' => 'payment_confirmed'])->save();

        RegisterDomainWithSpaceshipJob::dispatch($domainOrder->id);
    }
}
