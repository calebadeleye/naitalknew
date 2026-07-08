<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\HostingService;
use App\Models\IspConfigClientMapping;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientLifecycleController extends Controller
{
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
