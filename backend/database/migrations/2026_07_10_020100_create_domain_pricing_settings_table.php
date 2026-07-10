<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Single-row global config for FX conversion + default markup, so the admin
 * edits one settings record instead of re-entering an exchange rate on every
 * TLD. A dedicated table (not config()) so it's editable at runtime and
 * carries an audit trail (last_updated_by/at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_pricing_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('provider')->default('spaceship')->unique();
            $table->string('base_currency', 3)->default('USD');
            $table->string('target_currency', 3)->default('NGN');
            $table->decimal('exchange_rate', 12, 4)->nullable();
            $table->decimal('safety_buffer_percent', 5, 2)->default(0);
            // cost_plus_markup | percentage_markup | fixed_customer_price
            $table->string('default_markup_type')->default('cost_plus_markup');
            $table->unsignedBigInteger('default_markup_value_kobo')->default(0);
            $table->decimal('default_markup_percent', 5, 2)->nullable();
            $table->boolean('auto_sync_enabled')->default(false);
            // manual | weekly | monthly
            $table->string('sync_frequency')->default('manual');
            $table->string('last_updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_pricing_settings');
    }
};
