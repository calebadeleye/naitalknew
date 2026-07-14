<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminDomainOrderResource;
use App\Http\Resources\AdminDomainResource;
use App\Http\Resources\AdminDomainTransferResource;
use App\Http\Resources\AdminInvoiceResource;
use App\Http\Resources\AdminPaymentResource;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\DomainTransfer;
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
                'wallet',
                'wallet.transactions' => fn ($query) => $query->latest()->limit(20),
                'savedPaymentMethods',
            ])
            ->withSum(['invoices as total_revenue_kobo' => fn ($query) => $query], 'amount_paid_kobo')
            ->findOrFail($client);

        return response()->json($clientModel);
    }

    public function products(Request $request)
    {
        return HostingPlan::query()
            ->when($request->filled('is_active'), fn ($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->paginate(20)
            ->withQueryString();
    }

    public function orders(Request $request)
    {
        return Order::query()
            ->with(['client.user', 'items'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('billing_cycle'), fn ($query) => $query->where('billing_cycle', $request->string('billing_cycle')))
            ->latest()
            ->paginate(20)
            ->withQueryString();
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

    public function invoices(Request $request)
    {
        return AdminInvoiceResource::collection(
            Invoice::query()
                ->with('client.user')
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->latest()
                ->paginate(20)
                ->withQueryString()
        );
    }

    public function payments(Request $request)
    {
        return AdminPaymentResource::collection(
            Payment::query()
                ->with(['client.user', 'invoice'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->when($request->filled('gateway'), fn ($query) => $query->where('gateway', $request->string('gateway')))
                ->latest()
                ->paginate(20)
                ->withQueryString()
        );
    }

    public function tickets(Request $request)
    {
        return SupportTicket::query()
            ->with(['client.user', 'hostingService'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('priority'), fn ($query) => $query->where('priority', $request->string('priority')))
            ->latest()
            ->paginate(20)
            ->withQueryString();
    }

    public function provisioningLogs(Request $request)
    {
        return ProvisioningLog::query()
            ->with(['client.user', 'hostingService', 'order'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->latest()
            ->paginate(20)
            ->withQueryString();
    }

    public function ispConfigClientMappings(Request $request)
    {
        return IspConfigClientMapping::query()
            ->with('client.user')
            ->when($request->filled('sync_status'), fn ($query) => $query->where('sync_status', $request->string('sync_status')))
            ->latest()
            ->paginate(20)
            ->withQueryString();
    }

    public function auditLogs(Request $request)
    {
        return AuditLog::query()
            ->with(['client.user', 'hostingService', 'invoice'])
            ->when($request->filled('action'), fn ($query) => $query->where('action', 'like', '%'.$request->string('action').'%'))
            ->latest()
            ->paginate(20)
            ->withQueryString();
    }

    /**
     * Admin filters per spec §7: domain status, source, TLD, expiry date,
     * client, provider, linked-hosting status, transfer status.
     */
    public function domains(Request $request)
    {
        return AdminDomainResource::collection(
            Domain::query()
                ->with(['client.user', 'linkedHostingService', 'assignedBy'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->when($request->filled('source'), fn ($query) => $query->where('source', $request->string('source')))
                ->when($request->filled('tld'), fn ($query) => $query->where('tld', $request->string('tld')))
                ->when($request->filled('provider'), fn ($query) => $query->where('provider', $request->string('provider')))
                ->when($request->filled('client_id'), fn ($query) => $query->where('client_id', $request->integer('client_id')))
                ->when($request->filled('transfer_status'), fn ($query) => $query->where('transfer_status', $request->string('transfer_status')))
                ->when($request->filled('ownership_assignment_status'), fn ($query) => $query->where('ownership_assignment_status', $request->string('ownership_assignment_status')))
                ->when($request->filled('payment_status'), fn ($query) => $query->where('payment_status', $request->string('payment_status')))
                ->when($request->filled('registrar_operation_status'), fn ($query) => $query->where('registrar_operation_status', $request->string('registrar_operation_status')))
                ->when($request->filled('expires_before'), fn ($query) => $query->whereDate('expires_at', '<=', $request->string('expires_before')))
                ->when($request->boolean('without_hosting'), fn ($query) => $query->whereNull('linked_hosting_service_id'))
                ->when($request->boolean('with_hosting'), fn ($query) => $query->whereNotNull('linked_hosting_service_id'))
                ->when($request->boolean('expired'), fn ($query) => $query->whereDate('expires_at', '<', now()->toDateString()))
                ->when($request->boolean('renewal_due'), fn ($query) => $query->whereBetween('expires_at', [now()->toDateString(), now()->addDays(30)->toDateString()]))
                ->when($request->filled('auto_renew'), fn ($query) => $query->where('auto_renew', $request->boolean('auto_renew')))
                ->latest()
                ->paginate(20)
                ->withQueryString()
        );
    }

    public function domainOrders(Request $request)
    {
        return AdminDomainOrderResource::collection(
            DomainOrder::query()
                ->with(['client.user', 'invoice'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->when($request->filled('order_type'), fn ($query) => $query->where('order_type', $request->string('order_type')))
                ->when($request->filled('client_id'), fn ($query) => $query->where('client_id', $request->integer('client_id')))
                ->when($request->boolean('failed'), fn ($query) => $query->where('status', 'failed'))
                ->latest()
                ->paginate(20)
                ->withQueryString()
        );
    }

    public function domainTransfers(Request $request)
    {
        return AdminDomainTransferResource::collection(
            DomainTransfer::query()
                ->with(['client.user', 'invoice'])
                ->when($request->filled('transfer_status'), fn ($query) => $query->where('transfer_status', $request->string('transfer_status')))
                ->when($request->filled('client_id'), fn ($query) => $query->where('client_id', $request->integer('client_id')))
                ->latest()
                ->paginate(20)
                ->withQueryString()
        );
    }
}
