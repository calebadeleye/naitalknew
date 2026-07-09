<?php

namespace App\Services\Ispconfig;

use App\Models\AuditLog;
use App\Models\HostingService;
use App\Models\IspConfigServiceMapping;
use App\Models\ProvisioningLog;
use App\Models\User;
use App\Notifications\HostingDeletedFromIspConfig;
use App\Notifications\WebsiteHostingDeactivated;
use App\Notifications\WebsiteHostingReactivated;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * The single place that flips a hosting service's ISPConfig website between
 * active/inactive, or deletes it entirely. Reused by admin controllers,
 * security emergency actions, and the automatic expiry/grace-period jobs —
 * nothing else should call sitesWebDomainUpdate/sitesWebDomainDelete
 * directly for a hosting service's own website.
 */
class IspconfigWebsiteStatusService
{
    public function __construct(
        private readonly IspConfigClient $ispConfig,
        private readonly ClientNotifier $notifier,
    ) {
    }

    /**
     * @param  array{reason_category: string, reason_note: string, notify_client?: bool, effective_at?: ?string, supporting_reference?: ?string}  $reason
     * @param  array{notification: \Illuminate\Notifications\Notification, template: string, subject: string}|null  $notificationOverride  lets automatic jobs (e.g. grace-period-end suspension) send more specific wording than the generic "deactivated" email
     */
    public function deactivate(HostingService $service, array $reason, ?User $staff = null, bool $isSecurityAction = false, string $source = 'admin', string $targetStatus = 'deactivated', ?array $notificationOverride = null): HostingService
    {
        $before = $service->only(['status', 'ispconfig_active']);
        $ispconfigResponse = null;
        $errorDetails = null;

        try {
            $ispconfigResponse = $this->updateRemoteActiveFlag($service, active: false);
        } catch (IspConfigApiException $exception) {
            $errorDetails = $exception->safeMessage();
        }

        $service = DB::transaction(function () use ($service, $isSecurityAction, $errorDetails, $targetStatus) {
            $service->forceFill([
                'status' => $targetStatus,
                'deactivated_at' => now(),
                'is_security_action' => $isSecurityAction,
                'ispconfig_active' => $errorDetails ? $service->ispconfig_active : false,
            ])->save();

            return $service->fresh();
        });

        $this->log(
            action: $isSecurityAction ? 'security_deactivate_website' : 'deactivate_website',
            service: $service,
            staff: $staff,
            reason: $reason,
            before: $before,
            after: $service->only(['status', 'ispconfig_active']),
            source: $isSecurityAction ? 'security' : $source,
            ispconfigResponse: $ispconfigResponse,
            errorDetails: $errorDetails,
        );

        if ($reason['notify_client'] ?? true) {
            $this->notifier->notify(
                client: $service->client,
                notification: $notificationOverride['notification'] ?? new WebsiteHostingDeactivated($service, $reason['reason_category'], $reason['reason_note'], $isSecurityAction),
                template: $notificationOverride['template'] ?? 'website_hosting_deactivated',
                subject: $notificationOverride['subject'] ?? 'Your website hosting has been deactivated',
                service: $service,
            );
        }

        if ($errorDetails) {
            throw new IspConfigApiException($errorDetails, ['hosting_service_id' => $service->id]);
        }

        return $service;
    }

    /**
     * @param  array{reason_category: string, reason_note: string, notify_client?: bool, effective_at?: ?string, supporting_reference?: ?string}  $reason
     */
    public function reactivate(HostingService $service, array $reason, ?User $staff = null, string $source = 'admin'): HostingService
    {
        $before = $service->only(['status', 'ispconfig_active']);
        $ispconfigResponse = null;
        $errorDetails = null;

        try {
            $ispconfigResponse = $this->updateRemoteActiveFlag($service, active: true);
        } catch (IspConfigApiException $exception) {
            $errorDetails = $exception->safeMessage();
        }

        $service = DB::transaction(function () use ($service, $errorDetails) {
            $service->forceFill([
                'status' => 'active',
                'deactivated_at' => null,
                'is_security_action' => false,
                'ispconfig_active' => $errorDetails ? $service->ispconfig_active : true,
            ])->save();

            return $service->fresh();
        });

        $this->log(
            action: 'reactivate_website',
            service: $service,
            staff: $staff,
            reason: $reason,
            before: $before,
            after: $service->only(['status', 'ispconfig_active']),
            source: $source,
            ispconfigResponse: $ispconfigResponse,
            errorDetails: $errorDetails,
        );

        if ($reason['notify_client'] ?? true) {
            $this->notifier->notify(
                client: $service->client,
                notification: new WebsiteHostingReactivated($service),
                template: 'website_hosting_reactivated',
                subject: 'Your website hosting has been reactivated',
                service: $service,
            );
        }

        if ($errorDetails) {
            throw new IspConfigApiException($errorDetails, ['hosting_service_id' => $service->id]);
        }

        return $service;
    }

    /**
     * Permanently removes the website from ISPConfig after the
     * grace-period/final-warning pipeline has run its course. Never
     * hard-deletes the local HostingService row — only marks it
     * 'deleted_from_ispconfig'. The client account is never touched.
     *
     * @param  array{reason_category: string, reason_note: string, notify_client?: bool, effective_at?: ?string, supporting_reference?: ?string}  $reason
     */
    public function deleteFromIspConfig(HostingService $service, array $reason, ?User $staff = null, string $source = 'system'): HostingService
    {
        $before = $service->only(['status']);
        $mapping = $service->ispConfigServiceMappings()->latest('id')->first();
        $ispconfigResponse = null;
        $errorDetails = null;

        try {
            if ($mapping?->ispconfig_website_id) {
                $sessionId = $this->ispConfig->login();

                try {
                    $result = $this->ispConfig->sitesWebDomainDelete($sessionId, (int) $mapping->ispconfig_website_id);
                    $ispconfigResponse = ['deleted_domain_id' => $result];
                } finally {
                    $this->ispConfig->logout($sessionId);
                }
            }
        } catch (IspConfigApiException $exception) {
            $errorDetails = $exception->safeMessage();
        }

        $service = DB::transaction(function () use ($service) {
            $service->forceFill([
                'status' => 'deleted_from_ispconfig',
                'deleted_from_ispconfig_at' => now(),
                'ispconfig_active' => false,
            ])->save();

            return $service->fresh();
        });

        $this->log(
            action: 'delete_website_from_ispconfig',
            service: $service,
            staff: $staff,
            reason: $reason,
            before: $before,
            after: $service->only(['status']),
            source: $source,
            ispconfigResponse: $ispconfigResponse,
            errorDetails: $errorDetails,
        );

        if ($reason['notify_client'] ?? true) {
            $this->notifier->notify(
                client: $service->client,
                notification: new HostingDeletedFromIspConfig($service),
                template: 'hosting_deleted_from_ispconfig',
                subject: 'Your website hosting has been removed',
                service: $service,
            );
        }

        if ($errorDetails) {
            throw new IspConfigApiException($errorDetails, ['hosting_service_id' => $service->id]);
        }

        return $service;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function updateRemoteActiveFlag(HostingService $service, bool $active): ?array
    {
        $mapping = $service->ispConfigServiceMappings()->latest('id')->first();

        if (! $mapping?->ispconfig_website_id) {
            // Nothing provisioned in ISPConfig yet (e.g. still pending
            // payment) — local status still changes, there's just nothing
            // remote to flip.
            return null;
        }

        $clientMapping = $mapping->clientMapping;
        $sessionId = $this->ispConfig->login();

        try {
            $result = $this->ispConfig->sitesWebDomainUpdate(
                $sessionId,
                (int) ($clientMapping?->ispconfig_client_id ?: 0),
                (int) $mapping->ispconfig_website_id,
                ['active' => $active ? 'y' : 'n'],
            );

            $mapping->forceFill(['last_synced_at' => now()])->save();

            return ['domain_id' => $result, 'active' => $active];
        } finally {
            $this->ispConfig->logout($sessionId);
        }
    }

    /**
     * @param  array{reason_category: string, reason_note: string, notify_client?: bool, effective_at?: ?string, supporting_reference?: ?string}  $reason
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  array<string, mixed>|null  $ispconfigResponse
     */
    private function log(
        string $action,
        HostingService $service,
        ?User $staff,
        array $reason,
        array $before,
        array $after,
        string $source,
        ?array $ispconfigResponse,
        ?string $errorDetails,
    ): AuditLog {
        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'staff_user_id' => $staff?->id,
            'provider' => 'ispconfig',
            'action' => $action,
            'status' => $errorDetails ? 'failed' : 'completed',
            'message' => $errorDetails ?: ($reason['reason_note'] ?? null),
            'response_payload' => $ispconfigResponse,
            'finished_at' => now(),
        ]);

        return AuditLog::query()->create([
            'staff_user_id' => $staff?->id,
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => $action,
            'reason' => $reason['reason_note'] ?? null,
            'reason_category' => $reason['reason_category'] ?? null,
            'notify_client' => $reason['notify_client'] ?? true,
            'effective_at' => $reason['effective_at'] ?? now(),
            'supporting_reference' => $reason['supporting_reference'] ?? null,
            'source' => $source,
            'before_state' => $before,
            'after_state' => $after,
            'ispconfig_response' => $ispconfigResponse,
            'error_details' => $errorDetails,
        ]);
    }
}
