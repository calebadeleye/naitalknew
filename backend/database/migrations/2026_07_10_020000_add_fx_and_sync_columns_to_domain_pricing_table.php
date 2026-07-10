<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the existing domain_pricing table for automatic Spaceship price
 * syncing rather than duplicating it. registration_price_kobo/renewal_price_kobo/
 * transfer_price_kobo keep their existing meaning (the NGN cost basis markup
 * is applied to) — they're now populated by the sync service from
 * provider_*_price_minor × exchange_rate_to_ngn × (1 + safety_buffer_percent)
 * instead of being hand-typed by the admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('domain_pricing', function (Blueprint $table): void {
            $table->string('provider_currency', 3)->default('USD')->after('provider');
            $table->unsignedBigInteger('provider_registration_price_minor')->nullable()->after('provider_currency');
            $table->unsignedBigInteger('provider_renewal_price_minor')->nullable()->after('provider_registration_price_minor');
            $table->unsignedBigInteger('provider_transfer_price_minor')->nullable()->after('provider_renewal_price_minor');
            $table->decimal('exchange_rate_to_ngn', 12, 4)->nullable()->after('provider_transfer_price_minor');
            $table->decimal('safety_buffer_percent', 5, 2)->default(0)->after('exchange_rate_to_ngn');
            // Used only when markup_type = percentage_markup.
            $table->decimal('markup_percent', 5, 2)->nullable()->after('markup_value_kobo');
            $table->string('last_sync_status')->nullable()->after('last_synced_at'); // success | failed | null (never synced)
            $table->text('last_sync_error')->nullable()->after('last_sync_status');
            $table->json('metadata')->nullable()->after('last_sync_error');
        });
    }

    public function down(): void
    {
        Schema::table('domain_pricing', function (Blueprint $table): void {
            $table->dropColumn([
                'provider_currency',
                'provider_registration_price_minor',
                'provider_renewal_price_minor',
                'provider_transfer_price_minor',
                'exchange_rate_to_ngn',
                'safety_buffer_percent',
                'markup_percent',
                'last_sync_status',
                'last_sync_error',
                'metadata',
            ]);
        });
    }
};
