<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            // 'checkout' (normal order flow) vs 'ispconfig_import' (legacy
            // client pulled in read-only from an existing ISPConfig install).
            $table->string('source', 30)->default('checkout')->after('hosting_plan_id');
            $table->string('plan_type', 30)->default('website_care')->after('source');

            $table->timestamp('imported_at')->nullable()->after('provisioning_payload');
            $table->timestamp('last_synced_at')->nullable()->after('imported_at');
            $table->timestamp('created_from_ispconfig_at')->nullable()->after('last_synced_at');

            // 'ispconfig_created_date' | 'manual_required' | 'manual_override'
            $table->string('renewal_date_source', 30)->nullable()->after('created_from_ispconfig_at');
            // 'pending_manual_renewal_date' when no usable ISPConfig creation
            // date was found and an admin must supply one before renewal
            // reminders/invoicing can rely on it.
            $table->string('renewal_status', 40)->nullable()->after('renewal_date_source');

            $table->date('hosting_expires_at')->nullable()->after('renewal_status');
            $table->date('ssl_expires_at')->nullable()->after('hosting_expires_at');
            $table->date('next_invoice_date')->nullable()->after('ssl_expires_at');

            // 'standard' | 'legacy' — separate from plan_type so a legacy
            // service that has already been migrated to a Website Care plan
            // can still be identified as having started life as legacy.
            $table->string('migration_status', 20)->default('standard')->after('next_invoice_date');
            $table->foreignId('upgrade_target_package_id')->nullable()->after('migration_status')
                ->constrained('hosting_plans')->nullOnDelete();
            $table->timestamp('upgrade_notified_at')->nullable()->after('upgrade_target_package_id');
            $table->timestamp('migrated_at')->nullable()->after('upgrade_notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('upgrade_target_package_id');
            $table->dropColumn([
                'source',
                'plan_type',
                'imported_at',
                'last_synced_at',
                'created_from_ispconfig_at',
                'renewal_date_source',
                'renewal_status',
                'hosting_expires_at',
                'ssl_expires_at',
                'next_invoice_date',
                'migration_status',
                'upgrade_notified_at',
                'migrated_at',
            ]);
        });
    }
};
