<?php

namespace App\Jobs;

use App\Models\ProvisioningLog;
use App\Models\SoftwareInstallation;
use App\Services\Ispconfig\IspConfigClient;
use App\Services\SoftwareInstall\SoftwareInstallOrchestrator;
use App\Services\SoftwareInstall\SshCommandRunner;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Deliberately `tries = 1`, unlike the small single-call resource jobs
 * (DatabaseProvisioningActionJob, FtpAccountProvisioningActionJob) — a
 * software install is a long chain of steps, and blindly retrying the whole
 * chain from scratch after a partial failure risks double-provisioning a
 * database or Redis slot rather than fixing anything. SoftwareInstallOrchestrator
 * rolls back whatever it already created before this job marks the
 * installation failed.
 */
class SoftwareInstallJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 3600;

    public function __construct(public readonly int $softwareInstallationId)
    {
    }

    public function handle(SoftwareInstallOrchestrator $orchestrator, IspConfigClient $ispConfig): void
    {
        $installation = SoftwareInstallation::query()->find($this->softwareInstallationId);

        if (! $installation) {
            return;
        }

        try {
            $orchestrator->install($installation);

            ProvisioningLog::query()->create([
                'client_id' => $installation->hostingService?->client_id,
                'hosting_service_id' => $installation->hosting_service_id,
                'provider' => 'software_install',
                'action' => 'install_'.$installation->catalog_slug,
                'status' => 'completed',
                'message' => "Installed {$installation->catalog_slug} at {$installation->subdomain}.",
                'finished_at' => now(),
            ]);
        } catch (Throwable $exception) {
            $installation->forceFill([
                'status' => 'failed',
                'progress_step' => null,
                'error_message' => $exception->getMessage(),
            ])->save();

            ProvisioningLog::query()->create([
                'client_id' => $installation->hostingService?->client_id,
                'hosting_service_id' => $installation->hosting_service_id,
                'provider' => 'software_install',
                'action' => 'install_'.$installation->catalog_slug,
                'status' => 'failed',
                'message' => $exception->getMessage(),
                'finished_at' => now(),
            ]);
        }
    }
}
