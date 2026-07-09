<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Admin\Concerns\RequiresReasonForm;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\HostingService;
use App\Models\IspConfigClientMapping;
use App\Notifications\ClientAccountDeactivated;
use App\Notifications\ClientAccountRestored;
use App\Notifications\ClientAccountSuspended;
use App\Services\Ispconfig\IspconfigWebsiteStatusService;
use App\Services\Notifications\ClientNotifier;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class ClientLifecycleController extends Controller
{
    use RequiresReasonForm;

    private const CASCADABLE_SERVICE_STATUSES = ['active', 'suspended', 'expired', 'grace_period'];

    public function suspend(Request $request, Client $client, IspconfigWebsiteStatusService $websiteStatus, ClientNotifier $notifier)
    {
        $reasonForm = $this->validateReasonForm($request);
        $before = $client->only(['client_status', 'suspended_at']);

        $client->forceFill([
            'client_status' => 'suspended',
            'suspended_at' => now(),
        ])->save();

        $this->auditAction($request, 'suspend_client', $client, null, $before, $client->only(['client_status', 'suspended_at']), $reasonForm);

        $this->cascadeToActiveServices($client, $reasonForm, $websiteStatus);

        if ($reasonForm['notify_client']) {
            $notifier->notify(
                $client,
                new ClientAccountSuspended($reasonForm['reason_category'], $reasonForm['reason_note'], $reasonForm['effective_at']),
                'client_suspended',
                'Your NAI TALK account has been suspended',
            );
        }

        return response()->json($client->fresh('user'));
    }

    public function deactivate(Request $request, Client $client, IspconfigWebsiteStatusService $websiteStatus, ClientNotifier $notifier)
    {
        $reasonForm = $this->validateReasonForm($request);
        $before = $client->only(['client_status', 'deactivated_at']);

        $client->forceFill([
            'client_status' => 'deactivated',
            'deactivated_at' => now(),
        ])->save();

        $this->auditAction($request, 'deactivate_client', $client, null, $before, $client->only(['client_status', 'deactivated_at']), $reasonForm);

        $this->cascadeToActiveServices($client, $reasonForm, $websiteStatus);

        if ($reasonForm['notify_client']) {
            $notifier->notify(
                $client,
                new ClientAccountDeactivated($reasonForm['reason_category'], $reasonForm['reason_note'], $reasonForm['effective_at']),
                'client_deactivated',
                'Your NAI TALK account has been deactivated',
            );
        }

        return response()->json($client->fresh('user'));
    }

    /**
     * Soft-deletes the client. Orders, invoices, payments, services,
     * websites, ISPConfig references, notes and every log entry remain in
     * the database untouched — only the client row itself is marked
     * deleted_at so it drops out of normal admin views.
     */
    public function softDelete(Request $request, Client $client, IspconfigWebsiteStatusService $websiteStatus)
    {
        $reasonForm = $this->validateReasonForm($request);
        $before = $client->only(['client_status']);

        $this->cascadeToActiveServices($client, $reasonForm, $websiteStatus);

        $client->forceFill(['client_status' => 'deleted'])->save();
        $client->delete();

        $this->auditAction($request, 'soft_delete_client', $client, null, $before, ['client_status' => 'deleted', 'deleted_at' => now()->toIso8601String()], $reasonForm);

        return response()->json($client);
    }

    /**
     * Restores a soft-deleted client. Not gated behind the reason form —
     * only destructive/sensitive actions require one.
     */
    public function restore(Request $request, int $client, ClientNotifier $notifier)
    {
        $payload = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);
        $clientModel = Client::withTrashed()->findOrFail($client);
        $before = $clientModel->only(['client_status']);

        $clientModel->restore();
        $clientModel->forceFill(['client_status' => 'active'])->save();

        $this->audit($request, 'restore_client', $clientModel, null, $before, $clientModel->only(['client_status']), $payload['reason'] ?? null);

        $notifier->notify($clientModel, new ClientAccountRestored(), 'client_restored', 'Your NAI TALK account has been restored');

        return response()->json($clientModel->fresh('user'));
    }

    /**
     * Turns off ISPConfig hosting for every non-terminal service the client
     * has, without sending a separate per-service email — the client
     * already gets one consolidated email about the account-level action.
     * One failing service never blocks the others.
     */
    private function cascadeToActiveServices(Client $client, array $reasonForm, IspconfigWebsiteStatusService $websiteStatus): void
    {
        $services = $client->hostingServices()->whereIn('status', self::CASCADABLE_SERVICE_STATUSES)->get();

        foreach ($services as $service) {
            try {
                $websiteStatus->deactivate($service, array_merge($reasonForm, ['notify_client' => false]));
            } catch (Throwable) {
                // Already logged inside IspconfigWebsiteStatusService; don't
                // let one service's ISPConfig failure block the others.
            }
        }
    }

    public function convertToBillingClient(Request $request, Client $client)
    {
        $payload = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);
        $before = $client->only(['account_type', 'client_status']);

        $client->forceFill([
            'account_type' => 'billing_client',
            'client_status' => 'active',
            'last_activity_at' => now(),
        ])->save();

        $this->audit($request, 'convert_registered_user_to_billing_client', $client, null, $before, $client->only(['account_type', 'client_status']), $payload['reason'] ?? null);

        return response()->json($client->fresh('user'));
    }

    public function approveProvisioning(Request $request, HostingService $service, IspConfigProvisioningService $provisioning)
    {
        $payload = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $before = $service->only(['status', 'provisioning_status', 'provisioning_override_approved_at']);

        $service->forceFill([
            'status' => 'awaiting_provisioning',
            'provisioning_status' => 'awaiting_provisioning',
            'provisioning_override_approved_at' => now(),
            'provisioning_override_approved_by' => $request->user()->id,
        ])->save();

        $this->audit($request, 'approve_provisioning_override', $service->client, $service, $before, $service->only(['status', 'provisioning_status', 'provisioning_override_approved_at']), $payload['reason']);

        $provisioning->queueProvisioning($service, $request->user(), $payload['reason']);

        return response()->json([
            'service' => $service->fresh(),
            'queued' => true,
        ]);
    }

    public function retryProvisioning(Request $request, HostingService $service, IspConfigProvisioningService $provisioning)
    {
        $payload = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);

        $service->forceFill(['provisioning_status' => 'awaiting_provisioning'])->save();

        $provisioning->queueProvisioning($service, $request->user(), $payload['reason'] ?? 'Admin retry');

        return response()->json([
            'service' => $service->fresh(),
            'queued' => true,
        ]);
    }

    public function importLegacyClient(Request $request)
    {
        $payload = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'ispconfig_server_id' => ['required', 'integer', 'min:1'],
            'ispconfig_client_id' => ['required', 'string', 'max:160'],
            'metadata' => ['nullable', 'array'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $mapping = DB::transaction(function () use ($request, $payload) {
            $client = Client::query()->lockForUpdate()->findOrFail($payload['client_id']);
            $before = $client->only(['account_type', 'client_status']);

            $mapping = IspConfigClientMapping::query()->updateOrCreate(
                ['client_id' => $client->id, 'ispconfig_server_id' => $payload['ispconfig_server_id']],
                [
                    'ispconfig_client_id' => $payload['ispconfig_client_id'],
                    'sync_status' => 'provisioned',
                    'provisioned_at' => now(),
                    'last_synced_at' => now(),
                    'metadata_json' => array_merge($payload['metadata'] ?? [], [
                        'import_source' => 'ispconfig_legacy_import',
                        'invite_status' => 'not_sent',
                    ]),
                ]
            );

            $client->forceFill([
                'account_type' => 'imported_legacy_client',
                'client_status' => 'active',
                'last_activity_at' => now(),
            ])->save();

            $this->audit($request, 'import_existing_ispconfig_client', $client, null, $before, $client->only(['account_type', 'client_status']), $payload['reason'] ?? null);

            return $mapping;
        });

        return response()->json($mapping->load('client.user'), 201);
    }

    /**
     * Issues a fresh Sanctum token for the client's own user account so an
     * admin can view the client portal exactly as the client sees it (e.g.
     * for support). Always audited — impersonation is a privileged action.
     */
    public function impersonate(Request $request, Client $client)
    {
        $payload = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);

        $client->loadMissing('user');

        if (! $client->user) {
            abort(422, 'This client has no linked user account to impersonate.');
        }

        $token = $client->user->createToken('admin-impersonation')->plainTextToken;

        $this->audit(
            $request,
            'impersonate_client',
            $client,
            null,
            null,
            ['impersonated_by_staff_user_id' => $request->user()->id],
            $payload['reason'] ?? null
        );

        return response()->json([
            'token' => $token,
            'client' => $client,
            'user' => $client->user->only(['id', 'name', 'email']),
        ]);
    }

    public function syncClient(Request $request, Client $client)
    {
        $payload = $request->validate(['reason' => ['nullable', 'string', 'max:1000']]);

        $client->ispConfigClientMappings()->update([
            'sync_status' => 'sync_flagged_for_review',
            'last_synced_at' => now(),
        ]);

        $this->audit($request, 'sync_client_technical_record', $client, null, null, ['sync_status' => 'sync_flagged_for_review'], $payload['reason'] ?? null);

        return response()->json($client->load(['user', 'ispConfigClientMappings']));
    }

    private function audit(Request $request, string $action, ?Client $client, ?HostingService $service, ?array $before, ?array $after, ?string $reason): void
    {
        AuditLog::query()->create([
            'staff_user_id' => $request->user()?->id,
            'client_id' => $client?->id,
            'hosting_service_id' => $service?->id,
            'action' => $action,
            'reason' => $reason,
            'before_state' => $before,
            'after_state' => $after,
        ]);
    }
}
