<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\Admin\Concerns\RequiresReasonForm;
use App\Jobs\DeactivateIspconfigWebsiteJob;
use App\Jobs\ReactivateIspconfigWebsiteJob;
use App\Models\HostingService;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspconfigWebsiteStatusService;
use Illuminate\Http\Request;

class HostingServiceLifecycleController extends Controller
{
    use RequiresReasonForm;

    /**
     * Marks the service suspended (e.g. for non-payment) and queues turning
     * off the website in ISPConfig. Distinct from deactivateWebsite() only
     * in the resulting status label — both dispatch the same job.
     */
    public function suspendService(Request $request, HostingService $service)
    {
        $reasonForm = $this->validateReasonForm($request);

        DeactivateIspconfigWebsiteJob::dispatch($service->id, $reasonForm, $request->user()->id, false, 'admin', 'suspended');

        return response()->json(['service' => $service->fresh(), 'queued' => true]);
    }

    /**
     * Queues deactivating the website in ISPConfig. Set
     * is_security_action=true for emergency deactivations (malware, abuse,
     * server risk...) so the audit trail clearly shows this was
     * security-driven, not a normal expiry.
     */
    public function deactivateWebsite(Request $request, HostingService $service)
    {
        $reasonForm = $this->validateReasonForm($request);
        $isSecurityAction = $request->boolean('is_security_action');

        DeactivateIspconfigWebsiteJob::dispatch($service->id, $reasonForm, $request->user()->id, $isSecurityAction, 'admin', 'deactivated');

        return response()->json(['service' => $service->fresh(), 'queued' => true]);
    }

    public function reactivateWebsite(Request $request, HostingService $service)
    {
        $reasonForm = $this->validateReasonForm($request);

        ReactivateIspconfigWebsiteJob::dispatch($service->id, $reasonForm, $request->user()->id, 'admin');

        return response()->json(['service' => $service->fresh(), 'queued' => true]);
    }

    /**
     * Soft-deletes the local service record. Turns off ISPConfig hosting
     * first if it's still active — a deleted local record with hosting
     * still running remotely would be an inconsistent, orphaned state.
     */
    public function deleteService(Request $request, HostingService $service, IspconfigWebsiteStatusService $websiteStatus)
    {
        $reasonForm = $this->validateReasonForm($request);

        if (! in_array($service->status, ['deactivated', 'deleted_from_ispconfig', 'cancelled'], true)) {
            try {
                $websiteStatus->deactivate($service, array_merge($reasonForm, ['notify_client' => false]), $request->user(), false, 'admin', 'cancelled');
            } catch (IspConfigApiException) {
                // Logged inside the service; proceed with the local soft
                // delete regardless — the record must not be hard-deleted.
            }

            $service->refresh();
        }

        $before = $service->only(['status']);
        $service->delete();

        $this->auditAction($request, 'delete_service', $service->client, $service, $before, ['status' => $service->status, 'deleted_at' => now()->toIso8601String()], $reasonForm);

        return response()->json(['deleted' => true]);
    }

    public function scheduleAutoDeletion(Request $request, HostingService $service)
    {
        $payload = $request->validate(['scheduled_deletion_at' => ['required', 'date', 'after:today']]);
        $reasonForm = $this->validateReasonForm($request);
        $before = $service->only(['scheduled_deletion_at']);

        $service->forceFill(['scheduled_deletion_at' => $payload['scheduled_deletion_at']])->save();

        $this->auditAction($request, 'schedule_service_deletion', $service->client, $service, $before, $service->only(['scheduled_deletion_at']), $reasonForm);

        return response()->json($service->fresh());
    }

    public function overrideGracePeriod(Request $request, HostingService $service)
    {
        $payload = $request->validate(['grace_period_ends_at' => ['required', 'date']]);
        $reasonForm = $this->validateReasonForm($request);
        $before = $service->only(['grace_period_ends_at']);

        $service->forceFill(['grace_period_ends_at' => $payload['grace_period_ends_at']])->save();

        $this->auditAction($request, 'override_grace_period', $service->client, $service, $before, $service->only(['grace_period_ends_at']), $reasonForm);

        return response()->json($service->fresh());
    }
}
