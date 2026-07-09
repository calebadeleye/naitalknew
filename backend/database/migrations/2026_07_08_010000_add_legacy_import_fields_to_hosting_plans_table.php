<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_plans', function (Blueprint $table): void {
            // Distinguishes ordinary Website Care packages from internal-only
            // packages (e.g. Legacy Hosting + SSL) that exist purely to hold
            // imported ISPConfig clients until they're migrated.
            $table->string('plan_type', 30)->default('website_care')->after('slug');
            // is_active already gates provisioning eligibility; is_public is a
            // stricter, purely presentational gate so a plan can stay active
            // (billable, has services attached) without ever appearing on the
            // public pricing page or client order flow.
            $table->boolean('is_public')->default(true)->after('is_active');
            $table->boolean('is_orderable')->default(true)->after('is_public');
            $table->unsignedInteger('hosting_amount_kobo')->nullable()->after('setup_fee_kobo');
            $table->unsignedInteger('ssl_amount_kobo')->nullable()->after('hosting_amount_kobo');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_plans', function (Blueprint $table): void {
            $table->dropColumn(['plan_type', 'is_public', 'is_orderable', 'hosting_amount_kobo', 'ssl_amount_kobo']);
        });
    }
};
