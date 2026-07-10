<?php

namespace App\Services\Dashboard;

use App\Models\Client;
use App\Services\Billing\Money;
use App\Services\Wallet\WalletService;

class ClientDashboardService
{
    public function __construct(private readonly WalletService $walletService = new WalletService)
    {
    }

    public function snapshot(Client $client): array
    {
        $client->load(['user', 'hostingServices.hostingPlan', 'invoices', 'payments', 'supportTickets']);

        $outstanding = $client->invoices
            ->whereIn('status', ['unpaid', 'overdue', 'partially_paid'])
            ->sum(fn ($invoice) => $invoice->total_kobo - $invoice->amount_paid_kobo);
        $hasHosting = $client->hostingServices->isNotEmpty();
        $wallet = $this->walletService->walletFor($client);

        return [
            'client' => [
                'name' => $client->user->name,
                'email' => $client->user->email,
                'client_code' => $client->client_code,
                'account_type' => $client->account_type,
                'status' => $client->client_status,
            ],
            'empty_state' => $hasHosting ? null : [
                'title' => 'You do not have an active hosting service yet.',
                'actions' => [
                    ['label' => 'Explore Hosting Plans', 'href' => '/hosting'],
                    ['label' => 'Start a Website Project', 'href' => '/contact'],
                    ['label' => 'Contact Support', 'href' => '/support'],
                ],
            ],
            'metrics' => [
                ['label' => 'Active Services', 'value' => $client->hostingServices->where('status', 'active')->count()],
                ['label' => 'Outstanding Balance', 'value' => Money::naira($outstanding), 'raw' => $outstanding],
                ['label' => 'Next Renewal', 'value' => optional($client->hostingServices->whereNotNull('renews_at')->sortBy('renews_at')->first()?->renews_at)->toDateString()],
                ['label' => 'Total Paid', 'value' => Money::naira($client->payments->where('status', 'paid')->sum('amount_kobo'))],
                ['label' => 'Wallet Balance', 'value' => Money::naira($wallet->balance_kobo), 'raw' => $wallet->balance_kobo],
            ],
            'services' => $client->hostingServices->map(fn ($service) => [
                'id' => $service->id,
                'service_number' => $service->service_number,
                'primary_domain' => $service->primary_domain,
                'plan' => $service->hostingPlan?->name,
                'status' => $service->status,
                'provisioning_status' => $service->provisioning_status,
                'billing_cycle' => $service->billing_cycle,
                'renews_at' => $service->renews_at?->toDateString(),
            ])->values(),
            'recent_invoice' => optional($client->invoices->sortByDesc('created_at')->first(), fn ($invoice) => [
                'invoice_number' => $invoice->invoice_number,
                'status' => $invoice->status,
                'total' => Money::naira($invoice->total_kobo),
                'due_at' => $invoice->due_at?->toDateString(),
            ]),
            'tickets' => $client->supportTickets->sortByDesc('created_at')->take(5)->values(),
        ];
    }
}
