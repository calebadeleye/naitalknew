<?php

namespace App\Services\Billing;

use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\Invoice;
use Illuminate\Support\Carbon;

/**
 * Renewal rate and revenue-lost-to-churn, for a date range, built entirely
 * from existing billing records — no new tracking, no migrations. Hosting
 * has an authoritative signal (a renewal invoice's status), so its numbers
 * are exact. Domains don't: nothing flips a Domain's status when it lapses,
 * so a domain's renewal outcome is inferred from whether a completed
 * renewal DomainOrder exists — see renewedDomainOrderCount()'s docblock for
 * the caveat this introduces.
 */
class ChurnAnalyticsService
{
    public function renewalOverview(?string $from = null, ?string $to = null): array
    {
        [$rangeStart, $rangeEnd] = $this->resolveRange($from, $to);

        return [
            'date_range' => ['from' => $rangeStart->toDateString(), 'to' => $rangeEnd->toDateString()],
            'hosting' => $this->hostingRenewals($rangeStart, $rangeEnd),
            'domains' => $this->domainRenewals($rangeStart, $rangeEnd),
        ];
    }

    private function hostingRenewals(Carbon $rangeStart, Carbon $rangeEnd): array
    {
        $renewalInvoices = Invoice::query()
            ->whereNull('order_id')
            ->whereNotNull('hosting_service_id')
            ->where('invoice_number', 'like', 'INV-RENEWAL-%')
            ->whereBetween('due_at', [$rangeStart->toDateString(), $rangeEnd->toDateString()])
            ->with('hostingService.hostingPlan');

        $due = (clone $renewalInvoices)->count();
        $renewed = (clone $renewalInvoices)->where('status', 'paid')->count();

        $churnedRevenueKobo = (int) (clone $renewalInvoices)
            ->where('status', '!=', 'paid')
            ->sum('total_kobo');

        $byPlan = (clone $renewalInvoices)->get()
            ->groupBy(fn (Invoice $invoice) => $invoice->hostingService?->hostingPlan?->name ?? 'Unknown plan')
            ->map(function ($invoices, $planName) {
                $planDue = $invoices->count();
                $planRenewed = $invoices->where('status', 'paid')->count();

                return [
                    'plan' => $planName,
                    'due' => $planDue,
                    'renewed' => $planRenewed,
                    'renewal_rate' => $planDue > 0 ? round($planRenewed / $planDue * 100, 1) : null,
                ];
            })
            ->sortByDesc('due')
            ->values();

        return [
            'due' => $due,
            'renewed' => $renewed,
            'renewal_rate' => $due > 0 ? round($renewed / $due * 100, 1) : null,
            'churned_revenue' => $churnedRevenueKobo > 0 ? Money::naira($churnedRevenueKobo) : null,
            'by_plan' => $byPlan,
        ];
    }

    /**
     * A domain that lapses without any renewal attempt at all (common for
     * customers who never enabled auto-renew and simply don't come back)
     * never gets a DomainOrder — there's no invoice, no job, nothing. So
     * "renewed" here counts completed renewal orders in range, and "lapsed"
     * separately catches domains whose expires_at is still stuck inside
     * this range *and* already in the past — the only reliable sign a
     * domain never renewed, since a successful renewal would have pushed
     * expires_at forward and out of this range. due = renewed + lapsed.
     */
    private function domainRenewals(Carbon $rangeStart, Carbon $rangeEnd): array
    {
        $renewed = DomainOrder::query()
            ->where('order_type', 'renewal')
            ->where('status', 'completed')
            ->whereBetween('created_at', [$rangeStart, $rangeEnd])
            ->count();

        $lapsed = Domain::query()
            ->whereNotNull('client_id')
            ->whereBetween('expires_at', [$rangeStart->toDateString(), $rangeEnd->toDateString()])
            ->where('expires_at', '<', now())
            ->count();

        $due = $renewed + $lapsed;

        return [
            'due' => $due,
            'renewed' => $renewed,
            'renewal_rate' => $due > 0 ? round($renewed / $due * 100, 1) : null,
            'note' => 'Approximate — a domain that lapses without any renewal attempt (no auto-renew, customer never came back) is counted as churned; renewal timing is attributed to when it was actually processed, not the original due date.',
        ];
    }

    private function resolveRange(?string $from, ?string $to): array
    {
        $rangeEnd = $to ? Carbon::parse($to)->endOfDay() : now();
        $rangeStart = $from ? Carbon::parse($from)->startOfDay() : (clone $rangeEnd)->subDays(29)->startOfDay();

        return [$rangeStart, $rangeEnd];
    }
}
