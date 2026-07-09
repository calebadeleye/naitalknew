<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Services\Billing\LegacyRenewalInvoiceService;
use App\Services\Ispconfig\LegacyImportService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IspConfigLegacyImportController extends Controller
{
    /**
     * Read-only preview: fetches live ISPConfig data and reports what would
     * be created/linked/skipped, without writing anything locally.
     */
    public function preview(LegacyImportService $importer)
    {
        return response()->json($importer->run(dryRun: true));
    }

    /**
     * Performs the real import. Accepts an optional dry_run flag so the same
     * endpoint can be used for a final safety-check preview too.
     */
    public function run(Request $request, LegacyImportService $importer)
    {
        $payload = $request->validate(['dry_run' => ['nullable', 'boolean']]);

        return response()->json($importer->run(dryRun: (bool) ($payload['dry_run'] ?? false)));
    }

    /**
     * Admin manually supplies (or corrects) a legacy service's renewal date
     * when ISPConfig had no usable creation date, or to override a
     * calculated one.
     */
    public function overrideRenewalDate(Request $request, HostingService $service)
    {
        $payload = $request->validate([
            'renewal_date' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($service->migration_status !== 'legacy' && $service->source !== 'ispconfig_import') {
            abort(422, 'This service was not imported from ISPConfig — it does not use a legacy renewal date.');
        }

        $before = $service->only(['renewal_date_source', 'renewal_status', 'hosting_expires_at', 'ssl_expires_at', 'next_invoice_date']);

        $service->forceFill([
            'hosting_expires_at' => $payload['renewal_date'],
            'ssl_expires_at' => $payload['renewal_date'],
            'next_invoice_date' => $payload['renewal_date'],
            'renews_at' => $payload['renewal_date'],
            'next_due_date' => $payload['renewal_date'],
            'renewal_date_source' => 'manual_override',
            'renewal_status' => null,
        ])->save();

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => 'override_legacy_renewal_date',
            'reason' => $payload['reason'] ?? null,
            'before_state' => $before,
            'after_state' => $service->only(['renewal_date_source', 'renewal_status', 'hosting_expires_at', 'ssl_expires_at', 'next_invoice_date']),
        ]);

        return response()->json($this->serialize($service->fresh()));
    }

    /**
     * Manual, admin-triggered migration of a legacy service onto one of the
     * Website Care packages. Never happens automatically during import.
     */
    public function migrateToPackage(Request $request, HostingService $service)
    {
        $payload = $request->validate([
            'target_package_slug' => ['required', 'string', Rule::in(['starter-website-care', 'business-website-care', 'premium-website-care'])],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $targetPlan = HostingPlan::query()
            ->where('slug', $payload['target_package_slug'])
            ->where('is_active', true)
            ->firstOrFail();

        $before = $service->only(['hosting_plan_id', 'plan_type', 'migration_status', 'migrated_at']);

        $service->forceFill([
            'hosting_plan_id' => $targetPlan->id,
            'plan_type' => 'website_care',
            'migration_status' => 'migrated',
            'migrated_at' => now(),
        ])->save();

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'action' => 'migrate_legacy_service_to_website_care',
            'reason' => $payload['reason'] ?? null,
            'before_state' => $before,
            'after_state' => $service->fresh()->only(['hosting_plan_id', 'plan_type', 'migration_status', 'migrated_at']),
        ]);

        return response()->json($this->serialize($service->fresh('hostingPlan')));
    }

    /**
     * Marks that the client has been told about an upcoming migration to a
     * Website Care package, without performing the migration itself.
     */
    public function notifyUpgrade(Request $request, HostingService $service)
    {
        $payload = $request->validate([
            'target_package_slug' => ['required', 'string', Rule::in(['starter-website-care', 'business-website-care', 'premium-website-care'])],
        ]);

        $targetPlan = HostingPlan::query()->where('slug', $payload['target_package_slug'])->firstOrFail();

        $service->forceFill([
            'upgrade_target_package_id' => $targetPlan->id,
            'upgrade_notified_at' => now(),
        ])->save();

        return response()->json($this->serialize($service->fresh()));
    }

    public function generateInvoice(HostingService $service, LegacyRenewalInvoiceService $invoices)
    {
        return response()->json($invoices->generate($service), 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(HostingService $service): array
    {
        return array_merge($service->toArray(), [
            'hosting_expires_at' => $service->hosting_expires_at?->toDateString(),
            'ssl_expires_at' => $service->ssl_expires_at?->toDateString(),
            'next_invoice_date' => $service->next_invoice_date?->toDateString(),
            'created_from_ispconfig_at' => $service->created_from_ispconfig_at?->toDateString(),
            'migrated_at' => $service->migrated_at?->toIso8601String(),
            'upgrade_notified_at' => $service->upgrade_notified_at?->toIso8601String(),
        ]);
    }
}
