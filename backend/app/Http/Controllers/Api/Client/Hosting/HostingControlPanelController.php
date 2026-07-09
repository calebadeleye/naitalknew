<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Jobs\SyncDatabasesJob;
use App\Jobs\SyncFtpAccountsJob;
use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Jobs\SyncMailboxesJob;
use App\Models\HostingService;
use Illuminate\Http\Request;

class HostingControlPanelController extends Controller
{
    public function show(Request $request, HostingService $service)
    {
        $this->authorize('view', $service);

        $service->load('hostingPlan', 'ispConfigServiceMappings');
        $configuration = $service->hostingPlan?->configuration() ?? [];
        $snapshot = $service->latestUsageSnapshot();
        $mapping = $service->ispConfigServiceMappings->first();

        return response()->json([
            'overview' => [
                'primary_domain' => $service->primary_domain,
                'plan' => $service->hostingPlan?->name,
                'status' => $service->status,
                'provisioning_status' => $service->provisioning_status,
                'billing_cycle' => $service->billing_cycle,
                'renews_at' => $service->renews_at?->toDateString(),
                'auto_renew_enabled' => $service->auto_renew_enabled,
                'last_synced_at' => $mapping?->last_synced_at?->toIso8601String(),
            ],
            'usage' => $snapshot ? [
                'disk_used_mb' => $snapshot->disk_used_mb,
                'disk_quota_mb' => $snapshot->disk_quota_mb,
                'bandwidth_used_mb' => $snapshot->bandwidth_used_mb,
                'bandwidth_quota_mb' => $snapshot->bandwidth_quota_mb,
                'email_accounts_used' => $snapshot->email_accounts_used,
                'email_accounts_limit' => $snapshot->email_accounts_limit,
                'databases_used' => $snapshot->databases_used,
                'databases_limit' => $snapshot->databases_limit,
                'ftp_accounts_used' => $snapshot->ftp_accounts_used,
                'ftp_accounts_limit' => $snapshot->ftp_accounts_limit,
                'captured_at' => $snapshot->captured_at->toIso8601String(),
            ] : null,
            'capabilities' => [
                'email_accounts_enabled' => ($configuration['max_email_accounts'] ?? 0) > 0,
                'databases_enabled' => ($configuration['max_databases'] ?? 0) > 0,
                'ftp_sftp_enabled' => ($configuration['sftp_access_enabled'] ?? false) || ($configuration['ssh_access_enabled'] ?? false),
                'ssh_access_enabled' => (bool) ($configuration['ssh_access_enabled'] ?? false),
                'ssl_enabled' => (bool) ($configuration['ssl_enabled'] ?? false),
                'backup_enabled' => (bool) ($configuration['backup_enabled'] ?? false),
            ],
        ]);
    }

    public function refresh(Request $request, HostingService $service)
    {
        $this->authorize('manage', $service);

        SyncHostingUsageSnapshotJob::dispatch($service->id, 'manual_refresh');
        SyncMailboxesJob::dispatch($service->id);
        SyncDatabasesJob::dispatch($service->id);
        SyncFtpAccountsJob::dispatch($service->id);

        return response()->json(['message' => 'Refresh requested.'], 202);
    }

    public function updateAutoRenew(Request $request, HostingService $service)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate(['auto_renew_enabled' => ['required', 'boolean']]);

        $service->forceFill(['auto_renew_enabled' => $payload['auto_renew_enabled']])->save();

        return response()->json([
            'auto_renew_enabled' => $service->auto_renew_enabled,
            'message' => $service->auto_renew_enabled ? 'Auto-renew turned on.' : 'Auto-renew turned off.',
        ]);
    }
}
