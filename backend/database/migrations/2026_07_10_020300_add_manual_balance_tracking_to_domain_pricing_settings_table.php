<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Spaceship's API has no wallet/balance endpoint (confirmed against their
 * official docs), so per the spec's explicit fallback instruction, balance
 * is tracked manually by the admin rather than faked.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('domain_pricing_settings', function (Blueprint $table): void {
            $table->unsignedBigInteger('manual_balance_ngn_kobo')->nullable()->after('sync_frequency');
            $table->timestamp('manual_balance_checked_at')->nullable()->after('manual_balance_ngn_kobo');
            $table->unsignedBigInteger('low_balance_threshold_kobo')->default(10_000_000)->after('manual_balance_checked_at');
        });
    }

    public function down(): void
    {
        Schema::table('domain_pricing_settings', function (Blueprint $table): void {
            $table->dropColumn(['manual_balance_ngn_kobo', 'manual_balance_checked_at', 'low_balance_threshold_kobo']);
        });
    }
};
