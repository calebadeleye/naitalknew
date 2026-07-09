<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\IspConfigClientMapping;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProvisioningLog;
use App\Models\SupportTicket;
use Illuminate\Http\Request;

class RecordsController extends Controller
{
    public function clients(Request $request)
    {
        $clients = Client::query()
            ->with(['user', 'ispConfigClientMappings'])
            ->withCount([
                'hostingServices as active_services_count' => fn ($query) => $query->where('status', 'active'),
                'hostingServices',
            ])
            ->withSum([
                'invoices as outstanding_balance_kobo' => fn ($query) => $query->whereIn('status', ['unpaid', 'overdue', 'partially_paid']),
            ], 'total_kobo')
            ->withSum(['invoices as total_revenue_kobo' => fn ($query) => $query], 'amount_paid_kobo')
            ->withMin(['hostingServices as next_renewal_due' => fn ($query) => $query->where('status', 'active')->whereNotNull('renews_at')], 'renews_at')
            ->when($request->filled('account_type'), fn ($query) => $query->where('account_type', $request->string('account_type')))
            ->when($request->filled('client_status'), fn ($query) => $query->where('client_status', $request->string('client_status')))
            ->when($request->boolean('has_hosting_service'), fn ($query) => $query->has('hostingServices'))
            ->when($request->filled('ispconfig_provisioned'), function ($query) use ($request): void {
                $request->boolean('ispconfig_provisioned')
                    ? $query->has('ispConfigClientMappings')
                    : $query->doesntHave('ispConfigClientMappings');
            })
            ->when($request->filled('hosting_status'), function ($query) use ($request): void {
                $query->whereHas('hostingServices', fn ($services) => $services->where('status', $request->string('hosting_status')));
            })
            ->when($request->boolean('outstanding_invoice'), function ($query): void {
                $query->whereHas('invoices', fn ($invoices) => $invoices->whereIn('status', ['unpaid', 'overdue', 'partially_paid']));
            })
            ->when($request->boolean('trashed'), fn ($query) => $query->onlyTrashed())
            ->latest();

        return $clients->paginate(20)->withQueryString();
    }

    /**
     * withTrashed() so a soft-deleted client's detail page (and its
     * restore button) remains reachable from the admin UI.
     */
    public function clientDetail(int $client)
    {
        $clientModel = Client::withTrashed()
            ->with([
                'user',
                'ispConfigClientMappings',
                'hostingServices' => fn ($query) => $query->with('hostingPlan')->latest(),
                'invoices' => fn ($query) => $query->latest()->limit(20),
                'payments' => fn ($query) => $query->latest()->limit(20),
                'auditLogs' => fn ($query) => $query->latest()->limit(30),
                'notificationLogs' => fn ($query) => $query->latest()->limit(30),
            ])
            ->withSum(['invoices as total_revenue_kobo' => fn ($query) => $query], 'amount_paid_kobo')
            ->findOrFail($client);

        return response()->json($clientModel);
    }

    public function products()
    {
        return HostingPlan::query()->orderBy('sort_order')->paginate(20);
    }

    public function orders()
    {
        return Order::query()->with(['client.user', 'items'])->latest()->paginate(20);
    }

    public function services(Request $request)
    {
        return HostingService::query()
            ->with(['client.user', 'hostingPlan', 'ispConfigServiceMappings.clientMapping'])
            ->when($request->filled('service_type'), fn ($query) => $query->where('service_type', $request->string('service_type')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('hosting_plan_id'), fn ($query) => $query->where('hosting_plan_id', $request->integer('hosting_plan_id')))
            ->when($request->filled('client_id'), fn ($query) => $query->where('client_id', $request->integer('client_id')))
            ->when($request->filled('source'), fn ($query) => $query->where('source', $request->string('source')))
            ->when($request->filled('renews_before'), fn ($query) => $query->whereDate('renews_at', '<=', $request->string('renews_before')))
            ->when($request->filled('renews_after'), fn ($query) => $query->whereDate('renews_at', '>=', $request->string('renews_after')))
            ->when($request->boolean('trashed'), fn ($query) => $query->onlyTrashed())
            ->latest()
            ->paginate(20)
            ->withQueryString();
    }

    /**
     * withTrashed() so a soft-deleted service's detail page remains
     * reachable for review even after "Delete service" was used.
     */
    public function serviceDetail(int $service)
    {
        $serviceModel = HostingService::withTrashed()
            ->with([
                'client.user',
                'hostingPlan',
                'ispConfigServiceMappings.clientMapping',
                'mailboxRecords',
                'databaseRecords',
                'emailDomainRecords',
                'invoices' => fn ($query) => $query->latest()->limit(20),
                'provisioningLogs' => fn ($query) => $query->latest()->limit(30),
                'auditLogs' => fn ($query) => $query->latest()->limit(30),
            ])
            ->findOrFail($service);

        return response()->json($serviceModel);
    }

    public function invoices()
    {
        return Invoice::query()->with('client.user')->latest()->paginate(20);
    }

    public function payments()
    {
        return Payment::query()->with(['client.user', 'invoice'])->latest()->paginate(20);
    }

    public function tickets()
    {
        return SupportTicket::query()->with(['client.user', 'hostingService'])->latest()->paginate(20);
    }

    public function provisioningLogs()
    {
        return ProvisioningLog::query()->with(['client.user', 'hostingService', 'order'])->latest()->paginate(20);
    }

    public function ispConfigClientMappings()
    {
        return IspConfigClientMapping::query()->with('client.user')->latest()->paginate(20);
    }

    public function auditLogs()
    {
        return AuditLog::query()->with(['client.user', 'hostingService', 'invoice'])->latest()->paginate(20);
    }
}
