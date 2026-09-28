<?php

namespace App\Services\Ispconfig;

use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;

/**
 * Pushes a hosting plan's disk allowance onto the service's real ISPConfig
 * website (`hd_quota`), so what the client sees on their dashboard is what
 * the server actually enforces. Clients never log into ISPConfig — this is
 * the only way the number there ever changes.
 *
 * Shrinking a quota under a live site is the risky part (ISPConfig enforces
 * it with a filesystem quota, so a site over its limit can't write files or
 * receive mail), which is why a decrease is refused when the site is already
 * near the new limit.
 */
class HostingPlanQuotaService
{
    /** A site above this share of a *lower* new quota is not resized automatically. */
    private const SAFE_USAGE_RATIO = 0.9;

    public function __construct(private readonly IspConfigClient $ispConfig) {}

    /**
     * @return array{website_id: int, previous_quota_mb: int, new_quota_mb: int, used_mb: int, repaired_website_id: bool}
     *
     * @throws IspConfigApiException when the site can't be found or resizing it isn't safe
     */
    public function apply(HostingService $service, HostingPlan $plan, bool $dryRun = false): array
    {
        $targetMb = (int) ($plan->configuration()['disk_quota_mb'] ?? 0);

        if ($targetMb <= 0) {
            throw new IspConfigApiException("Plan {$plan->name} has no disk quota to apply.", ['hosting_service_id' => $service->id]);
        }

        $mapping = $service->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first();
        $ispClientId = (int) ($mapping?->clientMapping?->ispconfig_client_id ?: 0);

        if (! $mapping || $ispClientId <= 0) {
            throw new IspConfigApiException('This service has no ISPConfig client on record.', ['hosting_service_id' => $service->id]);
        }

        $sessionId = $this->ispConfig->login();

        try {
            $repaired = false;
            $website = $mapping->ispconfig_website_id ? $this->ispConfig->sitesWebDomainGet($sessionId, (int) $mapping->ispconfig_website_id) : null;

            // Some imported services point at a website id that was later
            // deleted and re-created under a new id — find the live site by
            // domain rather than resizing nothing (or the wrong site).
            if ($website === null) {
                $matches = array_values(array_filter(
                    $this->ispConfig->sitesWebDomainList($sessionId, ['domain' => $service->primary_domain]),
                    fn (array $site) => ($site['type'] ?? 'vhost') === 'vhost',
                ));

                if (count($matches) !== 1) {
                    throw new IspConfigApiException(
                        "Website {$service->primary_domain} could not be uniquely identified in ISPConfig (".count($matches).' matches).',
                        ['hosting_service_id' => $service->id],
                    );
                }

                $website = $matches[0];
                $repaired = true;
            }

            $websiteId = (int) $website['domain_id'];
            $previousMb = (int) ($website['hd_quota'] ?? -1);

            $usedMb = 0;
            foreach ($this->ispConfig->quotaGetByUser($sessionId, $ispClientId) as $row) {
                if ((int) ($row['domain_id'] ?? 0) === $websiteId) {
                    $usedMb = (int) ceil(((int) ($row['used'] ?? 0)) / 1024);
                    break;
                }
            }

            $isDecrease = $previousMb === -1 || $previousMb === 0 || $targetMb < $previousMb;

            if ($isDecrease && $usedMb > $targetMb * self::SAFE_USAGE_RATIO) {
                throw new IspConfigApiException(
                    "{$service->primary_domain} already uses {$usedMb} MB, too close to the {$targetMb} MB {$plan->name} allowance to resize safely.",
                    ['hosting_service_id' => $service->id],
                );
            }

            $summary = [
                'website_id' => $websiteId,
                'previous_quota_mb' => $previousMb,
                'new_quota_mb' => $targetMb,
                'used_mb' => $usedMb,
                'repaired_website_id' => $repaired,
            ];

            if ($dryRun) {
                return $summary;
            }

            $this->ispConfig->sitesWebDomainUpdate($sessionId, $ispClientId, $websiteId, ['hd_quota' => $targetMb]);

            $confirmed = $this->ispConfig->sitesWebDomainGet($sessionId, $websiteId);

            if ((int) ($confirmed['hd_quota'] ?? -999) !== $targetMb) {
                throw new IspConfigApiException(
                    "ISPConfig did not confirm the new disk quota for {$service->primary_domain}.",
                    ['hosting_service_id' => $service->id],
                );
            }

            $mapping->forceFill([
                'ispconfig_website_id' => (string) $websiteId,
                'last_synced_at' => now(),
                'metadata_json' => array_merge($mapping->metadata_json ?? [], $repaired ? ['previous_website_id' => $mapping->ispconfig_website_id] : []),
            ])->save();

            return $summary;
        } finally {
            $this->ispConfig->logout($sessionId);
        }
    }
}
