<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A per-service renewal price (ex-VAT, kobo) that overrides the plan price.
 * Legacy clients keep paying what they always paid (₦40,000 = hosting + SSL)
 * after being moved onto Starter Website Care, whose public price is lower
 * because it is sold to new customers at ₦25,000.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->unsignedBigInteger('renewal_price_kobo')->nullable()->after('amount_kobo');
        });

        // Services already moved off the legacy package (hosting:migrate-legacy)
        // keep the ₦40,000 they were paying, VAT-inclusive amount restored too.
        $legacyPrice = (int) DB::table('hosting_plans')->where('slug', 'legacy-hosting-ssl')->value('annual_price_kobo');

        if ($legacyPrice > 0) {
            $rate = (float) config('billing.vat_rate');

            DB::table('hosting_services')
                ->where('source', 'ispconfig_import')
                ->where('migration_status', 'migrated')
                ->update([
                    'renewal_price_kobo' => $legacyPrice,
                    'amount_kobo' => (int) round($legacyPrice * (1 + $rate)),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropColumn('renewal_price_kobo');
        });
    }
};
