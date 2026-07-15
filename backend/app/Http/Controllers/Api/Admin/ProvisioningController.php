<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\DetectMissingIspConfigResourcesJob;
use App\Jobs\DetectOrphanedIspConfigClientsJob;
use App\Jobs\SyncDatabasesJob;
use App\Jobs\SyncFtpAccountsJob;
use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Jobs\SyncIspConfigClientMappingsJob;
use App\Jobs\SyncIspConfigHostingServicesJob;
use App\Jobs\SyncMailboxesJob;
use App\Models\DatabaseRecord;
use App\Models\FtpAccountRecord;
use App\Models\HostingService;
use App\Models\HostingUsageSnapshot;
use App\Models\MailboxRecord;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigHealthCheckService;
use Illuminate\Http\Request;

class ProvisioningController extends Controller
{
    public function health(IspConfigHealthCheckService $healthCheck)
    {
        try {
            $healthCheck->check();
        } catch (IspConfigApiException $exception) {
            return response()->json(['healthy' => false, 'message' => $exception->safeMessage()], 503);
        }

        return response()->json(['healthy' => true, 'message' => 'ISPConfig login succeeded.']);
    }

    public function syncOne(Request $request, HostingService $service)
    {
        SyncHostingUsageSnapshotJob::dispatch($service->id, 'manual_refresh');
        SyncMailboxesJob::dispatch($service->id);
        SyncDatabasesJob::dispatch($service->id);
        SyncFtpAccountsJob::dispatch($service->id);
        SyncIspConfigHostingServicesJob::dispatch($service->id);

        return response()->json(['message' => 'Sync requested for this hosting service.'], 202);
    }

    public function syncAll(Request $request)
    {
        SyncIspConfigHostingServicesJob::dispatch();
        SyncIspConfigClientMappingsJob::dispatch();
        SyncHostingUsageSnapshotJob::dispatch();
        SyncMailboxesJob::dispatch();
        SyncDatabasesJob::dispatch();
        SyncFtpAccountsJob::dispatch();
        DetectOrphanedIspConfigClientsJob::dispatch();
        DetectMissingIspConfigResourcesJob::dispatch();

        return response()->json(['message' => 'Full ISPConfig sync requested.'], 202);
    }

    public function usageSnapshots()
    {
        return HostingUsageSnapshot::query()->with('hostingService.client.user')->latest('captured_at')->paginate(20);
    }

    public function mailboxRecords()
    {
        return MailboxRecord::query()->with('hostingService.client.user')->latest()->paginate(20);
    }

    public function databaseRecords()
    {
        return DatabaseRecord::query()->with('hostingService.client.user')->latest()->paginate(20);
    }

    /**
     * Covers both ISPConfig access types this app provisions under one
     * table: legacy 'ftp' (PureFTPd, no longer created) and 'sftp' (real
     * ISPConfig shell users — SSH + SFTP, jailkit-chrooted), distinguished
     * by FtpAccountRecord::access_type.
     */
    public function ftpAccountRecords()
    {
        return FtpAccountRecord::query()->with('hostingService.client.user')->latest()->paginate(20);
    }
}
