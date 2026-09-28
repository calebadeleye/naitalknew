<?php

namespace App\Services\Ispconfig;

use App\Models\AuditLog;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\ProvisioningLog;
use App\Models\User;
use App\Services\Billing\VatCalculator;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;

/**
 * Moves an imported (legacy) hosting service onto a Website Care package:
 * the ISPConfig website gets the package's real disk quota first, and only
 * once ISPConfig confirms it does the local record switch plans — so the
 * dashboard, the invoice/renewal price and the server never disagree.
 * Nothing changes locally if the remote step fails.
 */
class LegacyServiceMigrator
{
    public function __construct(
        private readonly HostingPlanQuotaService $quota,
        private readonly VatCalculator $vat = new VatCalculator,
    ) {}

    /**
     * @return array{status: string, message: string, quota: ?array<string, mixed>}
     */
    public function migrate(HostingService $service, HostingPlan $target, ?User $staff = null, ?string $reason = null, bool $dryRun = false): array
    {
        $before = $service->only(['hosting_plan_id', 'plan_type', 'migration_status', 'migrated_at', 'amount_kobo', 'renewal_price_kobo']);

        // Legacy clients keep the price they were paying (hosting + SSL);
        // the Starter list price is for new customers.
        $previousPlan = $service->hostingPlan;
        $keptPriceKobo = $previousPlan?->plan_type === 'legacy' ? (int) $previousPlan->annual_price_kobo : null;

        try {
            $quota = $this->quota->apply($service, $target, $dryRun);
        } catch (IspConfigApiException $exception) {
            $message = $exception->safeMessage();

            if (! $dryRun) {
                ProvisioningLog::query()->create([
                    'client_id' => $service->client_id,
                    'hosting_service_id' => $service->id,
                    'provider' => 'ispconfig',
                    'action' => 'migrate_to_website_care',
                    'status' => 'failed',
                    'message' => $message,
                    'finished_at' => now(),
                ]);
            }

            return ['status' => 'skipped', 'message' => $message, 'quota' => null];
        }

        if ($dryRun) {
            return ['status' => 'would_migrate', 'message' => 'Would move to '.$target->name.'.', 'quota' => $quota];
        }

        $service->forceFill([
            'hosting_plan_id' => $target->id,
            'plan_type' => 'website_care',
            'migration_status' => 'migrated',
            'migrated_at' => now(),
            // VAT-inclusive, like checkout-originated services.
            'renewal_price_kobo' => $keptPriceKobo ?: null,
            'amount_kobo' => $this->vat->calculate($keptPriceKobo ?: (int) $target->annual_price_kobo)['total_kobo'],
        ])->save();

        AuditLog::query()->create([
            'staff_user_id' => $staff?->id,
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => 'migrate_legacy_service_to_website_care',
            'reason' => $reason,
            'before_state' => $before,
            'after_state' => $service->fresh()->only(['hosting_plan_id', 'plan_type', 'migration_status', 'migrated_at', 'amount_kobo', 'renewal_price_kobo']) + ['ispconfig' => $quota],
            'source' => $staff ? 'admin' : 'system',
        ]);

        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'provider' => 'ispconfig',
            'action' => 'migrate_to_website_care',
            'status' => 'completed',
            'message' => "Moved to {$target->name}; disk quota {$quota['previous_quota_mb']} MB → {$quota['new_quota_mb']} MB.",
            'finished_at' => now(),
        ]);

        return ['status' => 'migrated', 'message' => 'Moved to '.$target->name.'.', 'quota' => $quota];
    }
}
