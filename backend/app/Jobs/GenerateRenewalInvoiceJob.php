<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Services\Billing\RenewalInvoiceService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Daily sweep that issues each standard (non-legacy) hosting service its
 * renewal invoice — and the invoice email, the first renewal notice — two
 * months before renews_at (renewal_invoice_lead_days), or straight away for
 * one already past it without an invoice. Auto-renewal charging happens
 * separately and only near the due date (ProcessAutoRenewalPaymentJob).
 * Legacy plan_type services keep using the separate, manually triggered
 * LegacyRenewalInvoiceService/admin flow.
 */
class GenerateRenewalInvoiceJob implements ShouldQueue
{
    use Queueable;

    public function handle(RenewalInvoiceService $renewals): void
    {
        $leadDays = (int) config('hosting_lifecycle.renewal_invoice_lead_days', 60);
        $targetDate = now()->addDays($leadDays)->toDateString();

        // Every service renewing within the lead window gets its invoice —
        // including one whose renewal date has already passed without one
        // (catch-up), and whether or not it auto-renews: a client who pays
        // manually needs the invoice just as much. Expired/grace services
        // still get one so they can pay before suspension.
        HostingService::query()
            ->subjectToLifecycle()
            ->whereIn('status', ['active', 'expired', 'grace_period'])
            ->where('plan_type', '!=', 'legacy')
            ->whereNotNull('renews_at')
            ->whereDate('renews_at', '<=', $targetDate)
            ->get()
            ->each(function (HostingService $service) use ($renewals): void {
                if ($renewals->hasRenewalInvoiceForCurrentCycle($service)) {
                    return;
                }

                $renewals->generateForRenewal($service);
            });
    }
}
