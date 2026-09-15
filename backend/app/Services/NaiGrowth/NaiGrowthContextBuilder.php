<?php

namespace App\Services\NaiGrowth;

use App\Models\Client;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\SupportTicket;
use App\Models\WebsiteQuoteRequest;
use App\Services\Billing\Money;
use Illuminate\Support\Carbon;

/**
 * Builds the FACT snapshot fed to NaiGrowth on every turn. Every figure here
 * comes from a live query against Naitalk's real data — nothing here is
 * invented, so the model has no excuse to fabricate revenue or client facts.
 */
class NaiGrowthContextBuilder
{
    public function build(): array
    {
        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();

        $monthRevenueKobo = Payment::query()
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$monthStart, $monthEnd])
            ->sum('amount_kobo');

        $targetKobo = (int) config('services.naigrowth.monthly_target_kobo');

        $overdueInvoices = Invoice::query()->where('status', 'overdue');
        $overdueCount = (clone $overdueInvoices)->count();
        $overdueKobo = (clone $overdueInvoices)->sum('total_kobo');

        return [
            'generated_at' => now()->toDateTimeString(),
            'revenue' => [
                'current_month_paid' => Money::naira($monthRevenueKobo),
                'current_month_paid_kobo' => $monthRevenueKobo,
                'monthly_target' => Money::naira($targetKobo),
                'monthly_target_kobo' => $targetKobo,
                'gap' => Money::naira(max(0, $targetKobo - $monthRevenueKobo)),
                'gap_kobo' => max(0, $targetKobo - $monthRevenueKobo),
            ],
            'overdue_invoices' => [
                'count' => $overdueCount,
                'amount' => Money::naira($overdueKobo),
            ],
            'upcoming_hosting_renewals' => HostingService::query()
                ->with(['client.user', 'hostingPlan'])
                ->where('status', 'active')
                ->whereNotNull('renews_at')
                ->whereBetween('renews_at', [now(), now()->addDays(30)])
                ->orderBy('renews_at')
                ->limit(10)
                ->get()
                ->map(fn (HostingService $service) => [
                    'client' => $service->client?->user?->name,
                    'plan' => $service->hostingPlan?->name,
                    'domain' => $service->primary_domain,
                    'renews_at' => $service->renews_at?->toDateString(),
                    'amount' => Money::naira($service->amount_kobo ?? 0),
                ]),
            'lead_pipeline' => [
                'by_status' => WebsiteQuoteRequest::query()
                    ->selectRaw('status, count(*) as count')
                    ->groupBy('status')
                    ->pluck('count', 'status'),
                'recent' => WebsiteQuoteRequest::query()
                    ->latest()
                    ->limit(10)
                    ->get(['name', 'website_type', 'estimated_budget', 'status', 'created_at'])
                    ->map(fn (WebsiteQuoteRequest $lead) => [
                        'name' => $lead->name,
                        'website_type' => $lead->website_type,
                        'estimated_budget' => $lead->estimated_budget,
                        'status' => $lead->status,
                        'created_at' => $lead->created_at?->toDateString(),
                    ]),
            ],
            'top_clients_by_lifetime_payments' => Client::query()
                ->with('user')
                ->withSum(['payments as lifetime_paid_kobo' => fn ($query) => $query->where('status', 'paid')], 'amount_kobo')
                ->orderByDesc('lifetime_paid_kobo')
                ->limit(5)
                ->get()
                ->map(fn (Client $client) => [
                    'client' => $client->user?->name ?? $client->company_name,
                    'company' => $client->company_name,
                    'industry' => $client->industry,
                    'lifetime_paid' => Money::naira((int) ($client->lifetime_paid_kobo ?? 0)),
                ]),
            'cross_sell_candidates' => Client::query()
                ->with('user')
                ->withCount(['hostingServices', 'orders'])
                ->get()
                ->filter(fn (Client $client) => $client->hosting_services_count > 0 && $client->orders_count <= 1)
                ->take(10)
                ->values()
                ->map(fn (Client $client) => [
                    'client' => $client->user?->name ?? $client->company_name,
                    'company' => $client->company_name,
                    'note' => 'Has active hosting but no other recorded order — potential SEO/maintenance/AI upsell.',
                ]),
            'open_support_tickets' => SupportTicket::query()->whereNotIn('status', ['closed', 'resolved'])->count(),
        ];
    }
}
