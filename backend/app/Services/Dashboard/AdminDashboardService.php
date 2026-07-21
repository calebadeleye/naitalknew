<?php

namespace App\Services\Dashboard;

use App\Models\Client;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProvisioningLog;
use App\Services\Billing\Money;
use Illuminate\Support\Carbon;

class AdminDashboardService
{
    /**
     * $from/$to are optional inclusive date bounds (Y-m-d). When omitted, the
     * dashboard falls back to its original unfiltered/last-30-days behaviour
     * so existing callers without a range keep working unchanged.
     */
    public function snapshot(?string $from = null, ?string $to = null): array
    {
        $rangeStart = $from ? Carbon::parse($from)->startOfDay() : null;
        $rangeEnd = $to ? Carbon::parse($to)->endOfDay() : null;
        $hasRange = $rangeStart && $rangeEnd;

        $revenueQuery = Payment::query()->where('status', 'paid');
        if ($hasRange) {
            $revenueQuery->whereBetween('paid_at', [$rangeStart, $rangeEnd]);
        }
        $paidRevenue = $revenueQuery->sum('amount_kobo');

        $overdueAmount = Invoice::query()->where('status', 'overdue')->sum('total_kobo');

        $invoiceCountQuery = fn () => Invoice::query()->when(
            $hasRange,
            fn ($query) => $query->whereBetween('issued_at', [$rangeStart->toDateString(), $rangeEnd->toDateString()])
        );

        $newClientsQuery = Client::query();
        $newClientsQuery = $hasRange
            ? $newClientsQuery->whereBetween('created_at', [$rangeStart, $rangeEnd])
            : $newClientsQuery->where('created_at', '>=', now()->subDays(30));

        $recentPaymentsQuery = Payment::query()->with(['client.user', 'invoice']);
        if ($hasRange) {
            $recentPaymentsQuery->whereBetween('created_at', [$rangeStart, $rangeEnd]);
        }

        $recentOrdersQuery = Order::query()->with('client.user');
        if ($hasRange) {
            $recentOrdersQuery->whereBetween('created_at', [$rangeStart, $rangeEnd]);
        }

        return [
            'date_range' => $hasRange ? ['from' => $rangeStart->toDateString(), 'to' => $rangeEnd->toDateString()] : null,
            'pending_payment_reviews' => Payment::query()
                ->where('gateway', 'bank_transfer')
                ->where('status', 'pending_review')
                ->count(),
            'metrics' => [
                ['label' => 'Total Revenue', 'value' => Money::naira($paidRevenue), 'raw' => $paidRevenue],
                ['label' => 'Total Invoices', 'value' => $invoiceCountQuery()->count()],
                ['label' => 'Paid Invoices', 'value' => $invoiceCountQuery()->where('status', 'paid')->count()],
                ['label' => 'Overdue Invoices', 'value' => Invoice::query()->where('status', 'overdue')->count(), 'amount' => Money::naira($overdueAmount)],
                ['label' => 'Active Services', 'value' => HostingService::query()->where('status', 'active')->count()],
                ['label' => 'New Clients', 'value' => $newClientsQuery->count()],
            ],
            'revenue_overview' => $this->monthlyRevenue(),
            'upcoming_renewals' => HostingService::query()
                ->with(['client.user', 'hostingPlan'])
                ->whereNotNull('renews_at')
                ->orderBy('renews_at')
                ->limit(8)
                ->get()
                ->map(fn (HostingService $service) => [
                    'service_number' => $service->service_number,
                    'client' => $service->client?->user?->name,
                    'plan' => $service->hostingPlan?->name,
                    'primary_domain' => $service->primary_domain,
                    'status' => $service->status,
                    'renews_at' => $service->renews_at?->toDateString(),
                ]),
            'recent_payments' => $recentPaymentsQuery
                ->latest()
                ->limit($hasRange ? 50 : 8)
                ->get()
                ->map(fn (Payment $payment) => [
                    'client' => $payment->client?->user?->name,
                    'invoice_number' => $payment->invoice?->invoice_number,
                    'gateway' => $payment->gateway,
                    'status' => $payment->status,
                    'amount' => Money::naira($payment->amount_kobo),
                    'paid_at' => $payment->paid_at?->toDateTimeString(),
                ]),
            'invoice_overview' => $invoiceCountQuery()
                ->selectRaw('status, count(*) as count, sum(total_kobo) as amount')
                ->groupBy('status')
                ->get(),
            'top_services' => HostingService::query()
                ->join('hosting_plans', 'hosting_services.hosting_plan_id', '=', 'hosting_plans.id')
                ->selectRaw('hosting_plans.name, count(*) as count')
                ->groupBy('hosting_plans.name')
                ->orderByDesc('count')
                ->limit(5)
                ->get(),
            'system_status' => [
                ['name' => 'ISPConfig Connection', 'status' => 'connected'],
                ['name' => 'Mail Server', 'status' => 'online'],
                ['name' => 'Queue Workers', 'status' => 'running'],
                ['name' => 'Scheduled Tasks', 'status' => 'healthy'],
                ['name' => 'Backup Service', 'status' => 'active'],
            ],
            'recent_orders' => $recentOrdersQuery
                ->latest()
                ->limit($hasRange ? 50 : 10)
                ->get()
                ->map(fn (Order $order) => [
                    'order_number' => $order->order_number,
                    'client' => $order->client?->user?->name,
                    'status' => $order->status,
                    'billing_cycle' => $order->billing_cycle,
                    'total' => Money::naira($order->total_kobo),
                    'created_at' => $order->created_at->toDateString(),
                ]),
            'provisioning' => ProvisioningLog::query()->latest()->limit(10)->get(),
        ];
    }

    private function monthlyRevenue(): array
    {
        return collect(range(5, 0))
            ->map(function (int $monthsAgo) {
                $month = now()->subMonths($monthsAgo);

                $amount = Payment::query()
                    ->where('status', 'paid')
                    ->whereBetween('paid_at', [
                        Carbon::parse($month)->startOfMonth(),
                        Carbon::parse($month)->endOfMonth(),
                    ])
                    ->sum('amount_kobo');

                return [
                    'month' => $month->format('M Y'),
                    'amount' => Money::naira($amount),
                    'raw' => $amount,
                ];
            })
            ->all();
    }
}
