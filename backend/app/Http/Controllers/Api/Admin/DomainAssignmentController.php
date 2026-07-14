<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncCloudflareDomainJob;
use App\Models\AuditLog;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Notifications\NaiTalkDomainAssignedToCustomer;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Http\Request;

/**
 * The imported-domain assignment workflow (spec: admin page for unassigned
 * Cloudflare domains). Assignment never creates an invoice by itself —
 * billing only ever starts once a domain is assigned and its normal
 * renewal-lead-window is reached, exactly like any other domain. It does
 * send the client a one-time "domain added to your account" notification.
 */
class DomainAssignmentController extends Controller
{
    public function __construct(private readonly ClientNotifier $notifier = new ClientNotifier) {}

    public function index(Request $request)
    {
        $domains = Domain::query()
            ->whereIn('ownership_assignment_status', ['unassigned', 'needs_review'])
            ->when($request->filled('provider'), fn ($query) => $query->where('provider', $request->string('provider')))
            ->when($request->filled('tld'), fn ($query) => $query->where('tld', $request->string('tld')))
            ->when($request->boolean('expiring_soon'), fn ($query) => $query->whereNotNull('expires_at')->whereDate('expires_at', '<=', now()->addDays(90)))
            ->with('client')
            ->latest()
            ->paginate(25);

        return response()->json($domains);
    }

    public function assign(Request $request, Domain $domain)
    {
        abort_if($domain->client_id !== null, 422, 'This domain is already assigned to a client — use reassign instead.');

        $payload = $this->validateAssignment($request);

        $this->applyAssignment($request, $domain, $payload, previousClientId: null, action: 'domain_ownership_assigned');

        return response()->json(['data' => $domain->fresh()]);
    }

    public function reassign(Request $request, Domain $domain)
    {
        abort_if($domain->client_id === null, 422, 'This domain has no current client — use assign instead.');

        $payload = $this->validateAssignment($request);
        $previousClientId = $domain->client_id;

        $this->applyAssignment($request, $domain, $payload, $previousClientId, action: 'domain_ownership_reassigned');

        return response()->json(['data' => $domain->fresh()]);
    }

    public function markInternal(Request $request, Domain $domain)
    {
        $payload = $request->validate([
            'assignment_note' => ['nullable', 'string', 'max:2000'],
        ]);

        abort_if($domain->linked_hosting_service_id, 422, 'Unlink hosting before marking this domain internal.');
        abort_if(
            DomainOrder::query()
                ->where('domain_id', $domain->id)
                ->whereHas('invoice', fn ($query) => $query->whereIn('status', ['unpaid', 'partially_paid']))
                ->exists(),
            422,
            'This domain has an outstanding invoice — resolve it before marking the domain internal.'
        );

        $previousClientId = $domain->client_id;

        $domain->forceFill([
            'client_id' => null,
            'ownership_assignment_status' => 'internal',
            'assigned_by' => $request->user()->id,
            'assigned_at' => now(),
            'assignment_note' => $payload['assignment_note'] ?? $domain->assignment_note,
        ])->save();

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $previousClientId,
            'action' => 'domain_marked_internal',
            'reason' => $payload['assignment_note'] ?? null,
            'before_state' => ['client_id' => $previousClientId],
            'after_state' => ['client_id' => null, 'ownership_assignment_status' => 'internal'],
            'supporting_reference' => $domain->domain_name,
            'source' => 'admin',
            'notify_client' => false,
        ]);

        return response()->json(['data' => $domain->fresh()]);
    }

    public function refreshFromCloudflare(Domain $domain)
    {
        abort_if($domain->provider !== 'cloudflare', 422, 'Only Cloudflare-provider domains can be refreshed from Cloudflare.');

        SyncCloudflareDomainJob::dispatch($domain);

        return response()->json(['message' => 'A refresh from Cloudflare has been queued.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateAssignment(Request $request): array
    {
        return $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'customer_renewal_price_kobo' => ['nullable', 'integer', 'min:0'],
            'next_invoice_date' => ['nullable', 'date'],
            'assignment_note' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function applyAssignment(Request $request, Domain $domain, array $payload, ?int $previousClientId, string $action): void
    {
        $domain->forceFill([
            'client_id' => $payload['client_id'],
            'ownership_assignment_status' => 'assigned',
            'assigned_by' => $request->user()->id,
            'assigned_at' => now(),
            'assignment_note' => $payload['assignment_note'] ?? $domain->assignment_note,
            'customer_renewal_price_kobo' => $payload['customer_renewal_price_kobo'] ?? $domain->customer_renewal_price_kobo,
            'next_invoice_date' => $payload['next_invoice_date'] ?? $domain->next_invoice_date,
        ])->save();

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $payload['client_id'],
            'action' => $action,
            'reason' => $payload['assignment_note'] ?? null,
            'before_state' => ['client_id' => $previousClientId],
            'after_state' => ['client_id' => $payload['client_id']],
            'supporting_reference' => $domain->domain_name,
            'source' => 'admin',
            'notify_client' => false,
        ]);

        $client = $domain->fresh()->client;

        if ($client) {
            $this->notifier->notify(
                client: $client,
                notification: new NaiTalkDomainAssignedToCustomer($domain),
                template: 'domain_assigned_to_customer',
                subject: "Your domain {$domain->domain_name} has been added to your NAI TALK account",
                domain: $domain->domain_name,
            );
        }
    }
}
