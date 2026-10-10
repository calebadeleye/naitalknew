<?php

namespace App\Services\Hosting;

use App\Jobs\ReactivateIspconfigWebsiteJob;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\ProvisioningLog;
use Illuminate\Support\Str;

/**
 * What happens to a hosting service when its renewal invoice is paid — by any
 * route (card, bank transfer, wallet, auto-renewal, or an admin marking it
 * paid): the renewal date moves one billing period on from the date it was
 * due (so the anniversary never drifts, whether paid early or late), any
 * grace/deletion schedule is cleared, and a lapsed service is restored.
 */
class HostingRenewalService
{
    /** Prefixes RenewalInvoiceService and LegacyRenewalInvoiceService give their invoices. */
    private const RENEWAL_INVOICE_PREFIXES = ['INV-RENEWAL-', 'INV-LEGACY-'];

    public static function isRenewalInvoice(Invoice $invoice): bool
    {
        return $invoice->hosting_service_id !== null
            && $invoice->order_id === null
            && Str::startsWith((string) $invoice->invoice_number, self::RENEWAL_INVOICE_PREFIXES);
    }

    public function applyPaidRenewal(Invoice $invoice): void
    {
        if ($invoice->status !== 'paid' || ! self::isRenewalInvoice($invoice)) {
            return;
        }

        $service = HostingService::query()->find($invoice->hosting_service_id);

        // Renewal invoices are due on the renewal date they cover. Once that
        // date has moved on, this payment was already applied — never twice.
        if (! $service || $service->renews_at?->toDateString() !== $invoice->due_at?->toDateString()) {
            return;
        }

        $previous = $service->renews_at->copy();
        $next = $service->billing_cycle === 'monthly' ? $previous->copy()->addMonthNoOverflow() : $previous->copy()->addYear();
        $wasSuspended = $service->status === 'suspended';

        $service->forceFill([
            'renews_at' => $next->toDateString(),
            'next_due_date' => $next->toDateString(),
            'grace_period_ends_at' => null,
            'scheduled_deletion_at' => null,
            'expired_at' => null,
            // Expired services were still live in their grace period; a
            // suspended one becomes active once ISPConfig turns it back on.
            'status' => $service->status === 'expired' ? 'active' : $service->status,
        ])->save();

        if ($wasSuspended) {
            ReactivateIspconfigWebsiteJob::dispatch(
                hostingServiceId: $service->id,
                reason: [
                    'reason_category' => 'renewal_paid',
                    'reason_note' => "Renewal invoice {$invoice->invoice_number} paid.",
                    'notify_client' => true,
                ],
                staffUserId: null,
                source: 'system',
            );
        }

        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'provider' => 'billing',
            'action' => 'renewal_applied',
            'status' => 'completed',
            'message' => "Renewal invoice {$invoice->invoice_number} paid: renews_at {$previous->toDateString()} -> {$next->toDateString()}".($wasSuspended ? '; website reactivation queued.' : '.'),
            'finished_at' => now(),
        ]);
    }
}
