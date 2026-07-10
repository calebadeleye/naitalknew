<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Services\Billing\RenewalInvoiceService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily sweep that generates a renewal invoice for standard (non-legacy)
 * auto-renewing hosting services once they're within the renewal lead
 * window — legacy plan_type services keep using the separate, manually
 * triggered LegacyRenewalInvoiceService/admin flow.
 */
class GenerateRenewalInvoiceJob implements ShouldQueue
{
    use Queueable;

    public function handle(RenewalInvoiceService $renewals): void
    {
        $leadDays = (int) config('hosting_lifecycle.renewal_invoice_lead_days', 7);
        $targetDate = now()->addDays($leadDays)->toDateString();

        HostingService::query()
            ->where('status', 'active')
            ->where('auto_renew_enabled', true)
            ->where('plan_type', '!=', 'legacy')
            ->whereNotNull('renews_at')
            ->whereDate('renews_at', '<=', $targetDate)
            ->whereDate('renews_at', '>=', now()->toDateString())
            ->get()
            ->each(function (HostingService $service) use ($renewals): void {
                if ($renewals->hasPendingRenewalInvoice($service)) {
                    return;
                }

                $renewals->generateForRenewal($service);
            });
    }
}
