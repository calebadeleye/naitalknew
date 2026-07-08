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
            ->latest();

        return $clients->paginate(20);
    }

    public function products()
    {
        return HostingPlan::query()->orderBy('sort_order')->paginate(20);
    }

    public function orders()
    {
        return Order::query()->with(['client.user', 'items'])->latest()->paginate(20);
    }

    public function services()
    {
        return HostingService::query()->with(['client.user', 'hostingPlan', 'ispConfigServiceMappings.clientMapping'])->latest()->paginate(20);
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
