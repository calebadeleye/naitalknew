<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\FtpAccountProvisioningActionJob;
use App\Models\AuditLog;
use App\Models\FtpAccountRecord;
use App\Models\HostingService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Admin-side SSH/SFTP account management for a hosting service — the same
 * underlying resource (an ISPConfig shell user, jailkit-chrooted to the
 * site's own document root) that a client creates for themselves under
 * Hosting > SSH/SFTP, just triggered by an admin on the client's behalf.
 *
 * The password is only ever knowable at the moment it's set (ISPConfig
 * doesn't return it, and we don't store it), so create/reset-password return
 * it once in the response — the admin must pass it on immediately, it can't
 * be retrieved again later.
 */
class FtpAccountController extends Controller
{
    public function index(HostingService $service)
    {
        return response()->json(['data' => $service->ftpAccountRecords()->latest()->get()]);
    }

    public function store(Request $request, HostingService $service)
    {
        $payload = $request->validate([
            'username' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_.-]+$/'],
            'password' => ['nullable', 'string', 'min:10', 'max:255'],
        ]);

        abort_if(
            FtpAccountRecord::query()->where('hosting_service_id', $service->id)->where('username', $payload['username'])->exists(),
            422,
            'An SSH/SFTP account with this username already exists.',
        );

        $password = $payload['password'] ?? Str::random(16);

        $ftpAccount = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => $payload['username'],
            // PureFTPd isn't reliably working on this server — see
            // App\Http\Controllers\Api\Client\Hosting\FtpAccountController.
            'access_type' => 'sftp',
            'status' => 'provisioning',
            'source' => 'admin_created',
        ]);

        FtpAccountProvisioningActionJob::dispatchSync($ftpAccount->id, 'create', ['password' => $password]);

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => 'create_ssh_sftp_account',
            'reason' => "Created SSH/SFTP account \"{$payload['username']}\" for {$service->primary_domain}.",
            'source' => 'admin',
            'notify_client' => false,
        ]);

        return response()->json(['data' => $ftpAccount->fresh(), 'password' => $password], 201);
    }

    public function resetPassword(Request $request, HostingService $service, FtpAccountRecord $ftpAccount)
    {
        abort_if($ftpAccount->hosting_service_id !== $service->id, 404);

        $payload = $request->validate(['password' => ['nullable', 'string', 'min:10', 'max:255']]);
        $password = $payload['password'] ?? Str::random(16);

        FtpAccountProvisioningActionJob::dispatchSync($ftpAccount->id, 'reset_password', ['password' => $password]);

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => 'reset_ssh_sftp_password',
            'reason' => "Reset the password for SSH/SFTP account \"{$ftpAccount->username}\".",
            'source' => 'admin',
            'notify_client' => false,
        ]);

        return response()->json(['data' => $ftpAccount->fresh(), 'password' => $password]);
    }

    public function disable(Request $request, HostingService $service, FtpAccountRecord $ftpAccount)
    {
        abort_if($ftpAccount->hosting_service_id !== $service->id, 404);

        FtpAccountProvisioningActionJob::dispatchSync($ftpAccount->id, 'disable');

        return response()->json(['data' => $ftpAccount->fresh()]);
    }

    public function destroy(Request $request, HostingService $service, FtpAccountRecord $ftpAccount)
    {
        abort_if($ftpAccount->hosting_service_id !== $service->id, 404);

        FtpAccountProvisioningActionJob::dispatchSync($ftpAccount->id, 'delete');

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => 'delete_ssh_sftp_account',
            'reason' => "Deleted SSH/SFTP account \"{$ftpAccount->username}\".",
            'source' => 'admin',
            'notify_client' => false,
        ]);

        return response()->json(['message' => 'SSH/SFTP account deleted.']);
    }
}
