<?php

namespace App\Services\Provisioning;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Models\HostingUsageSnapshot;
use App\Models\Invoice;
use App\Models\IspConfigClientMapping;
use App\Models\IspConfigServiceMapping;
use App\Models\ProvisioningLog;
use App\Models\User;
use App\Notifications\NaiTalkHostingProvisioned;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IspConfigProvisioningService
{
    public function __construct(private readonly IspConfigClient $client)
    {
    }

    /**
     * Writes the initial "queued" audit trail entry and dispatches the real
     * async provisioning job. This is the only place that should trigger
     * provisioning — never call ensureIspConfigClientForHostingService()
     * directly from a controller or request-time code path.
     */
    public function queueProvisioning(HostingService $service, ?User $staffUser = null, ?string $reason = null): ProvisioningLog
    {
        $log = ProvisioningLog::query()->create([
            'hosting_service_id' => $service->id,
            'client_id' => $service->client_id,
            'staff_user_id' => $staffUser?->id,
            'order_id' => $service->order_id,
            'provider' => 'ispconfig',
            'action' => 'create_hosting_service',
            'status' => $this->canProvision($service) ? 'queued' : 'blocked',
            'message' => $this->canProvision($service)
                ? 'Provisioning queued for the background worker.'
                : 'Provisioning blocked until hosting payment is verified or an admin approves an override.',
            'request_payload' => [
                'client_id' => $service->client_id,
                'plan_id' => $service->hosting_plan_id,
                'primary_domain' => $service->primary_domain,
                'provisioning_status' => $service->provisioning_status,
                'reason' => $reason,
            ],
        ]);

        if ($this->canProvision($service)) {
            ProvisionHostingServiceJob::dispatch($service->id, $staffUser?->id, $reason);
        }

        return $log;
    }

    /**
     * Provisions (or reuses) the ISPConfig client + website for this hosting
     * service using the real ISPConfig Remote API. Idempotent: safe to call
     * repeatedly — already-provisioned resources are never recreated.
     *
     * Only ever called from ProvisionHostingServiceJob.
     */
    public function ensureIspConfigClientForHostingService(HostingService $service, ?User $staffUser = null, ?string $reason = null): IspConfigServiceMapping
    {
        $service = HostingService::query()->whereKey($service->id)->lockForUpdate()->firstOrFail();
        $before = $service->only(['status', 'provisioning_status', 'ispconfig_server_id']);

        if (! $this->canProvision($service)) {
            $this->log($service, 'provisioning_blocked', 'blocked', 'Hosting payment is not verified and no admin override exists.', $staffUser, $before, $before, [
                'reason' => $reason,
            ]);

            abort(422, 'Hosting service cannot be provisioned until payment is verified or an admin override is approved.');
        }

        $plan = $service->hostingPlan;
        $configuration = $plan->configuration();
        $serverId = (int) ($service->ispconfig_server_id ?: $configuration['default_server_id'] ?: config('ispconfig.server_id'));

        $mapping = IspConfigClientMapping::query()->firstOrCreate(
            ['client_id' => $service->client_id, 'ispconfig_server_id' => $serverId],
            [
                'sync_status' => 'provisioning',
                'metadata_json' => [
                    'created_for_hosting_service_id' => $service->id,
                    'created_by' => $staffUser?->id ? 'admin_override' : 'payment_verification',
                ],
            ]
        );

        $serviceMapping = IspConfigServiceMapping::query()->firstOrCreate(
            ['hosting_service_id' => $service->id, 'ispconfig_server_id' => $serverId],
            [
                'ispconfig_client_mapping_id' => $mapping->id,
                'technical_status' => 'provisioning',
            ]
        );

        $needsClient = ! $mapping->ispconfig_client_id;
        $needsWebsite = ! $serviceMapping->ispconfig_website_id;
        $needsMailDomain = ($configuration['max_email_accounts'] ?? 0) > 0 && ! $serviceMapping->ispconfig_mail_domain_id;

        if ($needsClient || $needsWebsite || $needsMailDomain) {
            $sessionId = $this->client->login();

            try {
                if ($needsClient) {
                    $remoteClientId = $this->client->clientAdd(
                        $sessionId,
                        (int) (config('ispconfig.client_template_id') ?? 0),
                        $this->buildClientPayload($service),
                    );

                    $mapping->forceFill([
                        'ispconfig_client_id' => (string) $remoteClientId,
                        'sync_status' => 'provisioned',
                        'provisioned_at' => now(),
                        'last_synced_at' => now(),
                    ])->save();
                }

                if ($needsWebsite) {
                    $remoteWebsiteId = $this->client->sitesWebDomainAdd(
                        $sessionId,
                        (int) $mapping->ispconfig_client_id,
                        $this->buildWebsitePayload($service, $configuration, $serverId),
                    );

                    $serviceMapping->forceFill([
                        'ispconfig_client_mapping_id' => $mapping->id,
                        'ispconfig_website_id' => (string) $remoteWebsiteId,
                        'technical_status' => 'active',
                        'last_synced_at' => now(),
                        'metadata_json' => array_merge($serviceMapping->metadata_json ?? [], [
                            'idempotency_key' => $this->idempotencyKey($service),
                        ]),
                    ])->save();
                }

                if ($needsMailDomain) {
                    // Mailboxes cannot be created until the domain is registered as a mail
                    // domain in ISPConfig — a separate module from the website/vhost record.
                    $remoteMailDomainId = $this->client->mailDomainAdd(
                        $sessionId,
                        (int) $mapping->ispconfig_client_id,
                        [
                            'domain' => $service->primary_domain,
                            'server_id' => $serverId,
                            'active' => 'y',
                        ],
                    );

                    $serviceMapping->forceFill([
                        'ispconfig_mail_domain_id' => (string) $remoteMailDomainId,
                        'last_synced_at' => now(),
                    ])->save();
                }
            } finally {
                $this->client->logout($sessionId);
            }
        }

        DB::transaction(function () use ($service, $serviceMapping, $serverId, $configuration): void {
            $service->forceFill([
                'status' => 'active',
                'provisioning_status' => 'provisioned',
                'starts_at' => $service->starts_at ?: now()->toDateString(),
                'ispconfig_server_id' => $serverId,
                'ispconfig_site_id' => $serviceMapping->ispconfig_website_id,
            ])->save();

            $service->client->forceFill([
                'account_type' => 'hosting_client',
                'client_status' => 'active',
                'last_activity_at' => now(),
            ])->save();

            HostingUsageSnapshot::query()->create([
                'hosting_service_id' => $service->id,
                'disk_used_mb' => 0,
                'disk_quota_mb' => $configuration['disk_quota_mb'],
                'bandwidth_used_mb' => 0,
                'bandwidth_quota_mb' => $configuration['bandwidth_quota_mb'],
                'email_accounts_used' => 0,
                'email_accounts_limit' => $configuration['max_email_accounts'],
                'databases_used' => 0,
                'databases_limit' => $configuration['max_databases'],
                'ftp_accounts_used' => 0,
                'ftp_accounts_limit' => $configuration['max_ftp_accounts'],
                'ssh_sftp_enabled' => (bool) $configuration['ssh_access_enabled'] || (bool) $configuration['sftp_access_enabled'],
                'captured_at' => now(),
                'source' => 'provisioning',
            ]);
        });

        if ($before['status'] !== 'active') {
            $service->client->user?->notify(new NaiTalkHostingProvisioned($service));
        }

        $this->log($service, 'provision_hosting_service', 'completed', 'ISPConfig client and website are provisioned.', $staffUser, $before, $service->only(['status', 'provisioning_status', 'ispconfig_server_id']), [
            'reason' => $reason,
            'mapping_id' => $mapping->id,
            'service_mapping_id' => $serviceMapping->id,
        ]);

        return $serviceMapping;
    }

    public function canProvision(HostingService $service): bool
    {
        return $service->provisioning_override_approved_at !== null || $this->hasVerifiedPaidInvoice($service);
    }

    public function hasVerifiedPaidInvoice(HostingService $service): bool
    {
        if (! $service->order_id) {
            return false;
        }

        return Invoice::query()
            ->where('order_id', $service->order_id)
            ->where('status', 'paid')
            ->exists();
    }

    public function log(HostingService $service, string $action, string $status, string $message, ?User $staffUser = null, ?array $before = null, ?array $after = null, array $payload = []): ProvisioningLog
    {
        return ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'staff_user_id' => $staffUser?->id,
            'hosting_service_id' => $service->id,
            'order_id' => $service->order_id,
            'provider' => 'ispconfig',
            'action' => $action,
            'status' => $status,
            'message' => $message,
            'before_state' => $before,
            'after_state' => $after,
            'request_payload' => $payload,
            'finished_at' => now(),
        ]);
    }

    public function idempotencyKey(HostingService $service): string
    {
        return 'hosting-service:'.$service->id.':server:'.($service->ispconfig_server_id ?: 1);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildClientPayload(HostingService $service): array
    {
        $client = $service->client;

        return [
            'company_name' => $client->company_name ?: $client->billing_email,
            'contact_name' => $client->user?->name,
            'username' => $this->buildIspConfigUsername($service),
            // The client never logs into ISPConfig directly (no credentials are ever
            // exposed to the client portal) — this is a throwaway internal value
            // required by client_add, not stored anywhere on our side.
            'password' => Str::random(24),
            'language' => 'en',
            'email' => $client->billing_email ?: $client->user?->email,
            'phone' => $client->billing_phone,
            'city' => $client->city,
            'country' => $client->country,
            // Without a client template, ISPConfig requires these explicitly —
            // conservative defaults; site-level ssh_chroot/php handling in
            // buildWebsitePayload() is what actually governs the package's
            // enabled capabilities.
            'web_php_options' => 'no,fast-cgi,php-fpm',
            'ssh_chroot' => 'no',
        ];
    }

    /**
     * Uses the website name (domain, minus its TLD) as the ISPConfig username —
     * readable in the ISPConfig panel and unique since no two hosting services
     * share a domain. Falls back to the client code if the domain is unusable.
     */
    private function buildIspConfigUsername(HostingService $service): string
    {
        $domainLabel = Str::of($service->primary_domain ?: '')->before('.')->lower()->replaceMatches('/[^a-z0-9]/', '');
        $base = $domainLabel->isNotEmpty() ? $domainLabel : Str::of($service->client->client_code)->lower()->replaceMatches('/[^a-z0-9]/', '');

        return $base->limit(16, '').'-'.$service->client_id;
    }

    /**
     * @param  array<string, mixed>  $configuration
     * @return array<string, mixed>
     */
    private function buildWebsitePayload(HostingService $service, array $configuration, int $serverId): array
    {
        return [
            'server_id' => $serverId,
            'domain' => $service->primary_domain,
            'hd_quota' => $configuration['disk_quota_mb'],
            'traffic_quota' => $configuration['bandwidth_quota_mb'],
            'php_version' => $configuration['php_version'] ?? '8.2',
            'ssl' => ($configuration['ssl_enabled'] ?? true) ? 'y' : 'n',
            'ssh_chroot' => ($configuration['ssh_access_enabled'] ?? false) ? 'jailkit' : 'no',
            'active' => 'y',
            'type' => 'vhost',
            'ip_address' => '*',
            'allow_override' => 'All',
            'http_port' => '80',
            'https_port' => '443',
            'pm_process_idle_timeout' => '10',
            'pm_max_requests' => '0',
        ];
    }
}
