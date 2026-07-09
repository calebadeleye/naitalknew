<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            // Groups services for the admin dashboard: hosting, ssl, domain,
            // email, website_maintenance, support, website_development,
            // custom_services, legacy_hosting_ssl.
            $table->string('service_type', 40)->default('hosting')->after('plan_type')->index();

            $table->timestamp('expired_at')->nullable()->after('suspended_at');
            $table->date('grace_period_ends_at')->nullable()->after('expired_at');
            $table->timestamp('deactivated_at')->nullable()->after('grace_period_ends_at');
            $table->date('scheduled_deletion_at')->nullable()->after('deactivated_at');
            $table->timestamp('deleted_from_ispconfig_at')->nullable()->after('scheduled_deletion_at');

            // True when the most recent deactivation was security-driven
            // (malware/abuse/etc) rather than a normal expiry/non-payment
            // action — kept separate from `status` so it survives status
            // transitions and shows clearly in reporting.
            $table->boolean('is_security_action')->default(false)->after('deleted_from_ispconfig_at');

            // Mirrors ISPConfig's own web_domain.active ('y'/'n') so the
            // admin can see at a glance whether the local status and the
            // remote ISPConfig state actually agree.
            $table->boolean('ispconfig_active')->nullable()->after('is_security_action');

            $table->softDeletes();
        });

        $this->backfillServiceType();
    }

    /**
     * Existing rows predate the service_type column — infer a reasonable
     * value from the plan and display name rather than leaving everything
     * as the 'hosting' default, which would make the new grouped dashboard
     * useless for data that already exists.
     */
    private function backfillServiceType(): void
    {
        DB::table('hosting_services')->where('plan_type', 'legacy')->update(['service_type' => 'legacy_hosting_ssl']);

        $keywordMap = [
            'email' => 'email',
            'mail' => 'email',
            'ssl' => 'ssl',
            'certificate' => 'ssl',
            'domain' => 'domain',
            'maintenance' => 'website_maintenance',
            'support' => 'support',
            'develop' => 'website_development',
        ];

        DB::table('hosting_services')
            ->where('plan_type', '!=', 'legacy')
            ->whereNotNull('display_name')
            ->get(['id', 'display_name'])
            ->each(function (object $service) use ($keywordMap): void {
                $haystack = mb_strtolower($service->display_name ?? '');

                foreach ($keywordMap as $needle => $type) {
                    if (str_contains($haystack, $needle)) {
                        DB::table('hosting_services')->where('id', $service->id)->update(['service_type' => $type]);

                        return;
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn([
                'service_type',
                'expired_at',
                'grace_period_ends_at',
                'deactivated_at',
                'scheduled_deletion_at',
                'deleted_from_ispconfig_at',
                'is_security_action',
                'ispconfig_active',
            ]);
        });
    }
};
