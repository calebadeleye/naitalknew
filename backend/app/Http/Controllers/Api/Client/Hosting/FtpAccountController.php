<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Jobs\FtpAccountProvisioningActionJob;
use App\Models\FtpAccountRecord;
use App\Models\HostingService;
use Illuminate\Http\Request;

class FtpAccountController extends Controller
{
    public function index(Request $request, HostingService $service)
    {
        $this->authorize('viewAny', [FtpAccountRecord::class, $service]);

        return response()->json([
            'ftp_accounts' => $service->ftpAccountRecords()->get(),
            'limit' => (int) ($service->hostingPlan?->configuration()['max_ftp_accounts'] ?? 0),
            'server_hostname' => config('ispconfig.public_hostname'),
        ]);
    }

    public function store(Request $request, HostingService $service)
    {
        $this->authorize('create', [FtpAccountRecord::class, $service]);

        $payload = $request->validate([
            'username' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_.-]+$/'],
            'password' => ['required', 'string', 'min:10', 'max:255'],
        ]);

        abort_if(
            FtpAccountRecord::query()->where('hosting_service_id', $service->id)->where('username', $payload['username'])->exists(),
            422,
            'An SSH/SFTP account with this username already exists.',
        );

        $ftpAccount = FtpAccountRecord::query()->create([
            'hosting_service_id' => $service->id,
            'username' => $payload['username'],
            // PureFTPd isn't reliably working on this server, so self-service
            // accounts are provisioned as ISPConfig "shell users" — real SSH
            // + SFTP accounts, jailkit-chrooted to the website's own root.
            'access_type' => 'sftp',
            'status' => 'provisioning',
        ]);

        FtpAccountProvisioningActionJob::dispatch($ftpAccount->id, 'create', ['password' => $payload['password']]);

        return response()->json([...$ftpAccount->toArray(), 'server_hostname' => config('ispconfig.public_hostname')], 202);
    }

    public function resetPassword(Request $request, HostingService $service, FtpAccountRecord $ftpAccount)
    {
        $this->authorize('update', $ftpAccount);
        abort_if($ftpAccount->hosting_service_id !== $service->id, 404);

        $payload = $request->validate([
            'password' => ['required', 'string', 'min:10', 'max:255', 'confirmed'],
        ]);

        FtpAccountProvisioningActionJob::dispatch($ftpAccount->id, 'reset_password', ['password' => $payload['password']]);

        return response()->json(['message' => 'FTP password reset requested.'], 202);
    }

    public function disable(Request $request, HostingService $service, FtpAccountRecord $ftpAccount)
    {
        $this->authorize('update', $ftpAccount);
        abort_if($ftpAccount->hosting_service_id !== $service->id, 404);

        FtpAccountProvisioningActionJob::dispatch($ftpAccount->id, 'disable');

        return response()->json(['message' => 'FTP account disable requested.'], 202);
    }

    public function destroy(Request $request, HostingService $service, FtpAccountRecord $ftpAccount)
    {
        $this->authorize('delete', $ftpAccount);
        abort_if($ftpAccount->hosting_service_id !== $service->id, 404);

        $request->validate(['confirm' => ['required', 'accepted']]);

        $ftpAccount->forceFill(['status' => 'provisioning'])->save();

        FtpAccountProvisioningActionJob::dispatch($ftpAccount->id, 'delete');

        return response()->json(['message' => 'FTP account deletion requested.'], 202);
    }
}
