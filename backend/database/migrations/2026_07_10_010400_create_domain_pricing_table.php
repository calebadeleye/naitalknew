<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_pricing', function (Blueprint $table): void {
            $table->id();
            $table->string('tld', 30)->unique();
            $table->string('provider')->default('spaceship');
            $table->string('currency')->default('NGN');
            $table->unsignedBigInteger('registration_price_kobo')->default(0);
            $table->unsignedBigInteger('renewal_price_kobo')->default(0);
            $table->unsignedBigInteger('transfer_price_kobo')->default(0);
            // cost_plus_markup | fixed_customer_price | manual_price
            $table->string('markup_type')->default('cost_plus_markup');
            $table->unsignedBigInteger('markup_value_kobo')->default(0);
            $table->unsignedBigInteger('fixed_customer_price_kobo')->nullable();
            // needs_review | active | inactive
            $table->string('status')->default('needs_review');
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_pricing');
    }
};
