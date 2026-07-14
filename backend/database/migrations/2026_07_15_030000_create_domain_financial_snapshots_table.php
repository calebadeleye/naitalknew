<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only record of the exact cost/FX/markup/tax/profit figures at the
 * moment of a registration, transfer, or renewal — deliberately never
 * updated afterward, since historical transactions must never be
 * recalculated using a later exchange rate or later TLD pricing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_financial_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('domain_id')->nullable()->constrained('domains')->nullOnDelete();
            $table->foreignId('domain_order_id')->nullable()->constrained('domain_orders')->nullOnDelete();
            // registration | transfer | renewal
            $table->string('event_type');
            $table->string('provider');
            $table->unsignedBigInteger('provider_cost_minor')->nullable();
            $table->string('provider_currency', 3)->nullable();
            // Matches domain_pricing.exchange_rate_to_ngn's representation exactly.
            $table->decimal('exchange_rate_to_ngn', 12, 4)->nullable();
            $table->unsignedBigInteger('converted_cost_kobo')->nullable();
            $table->string('markup_type')->nullable();
            $table->unsignedBigInteger('markup_amount_kobo')->nullable();
            $table->unsignedBigInteger('tax_kobo')->nullable();
            $table->unsignedBigInteger('customer_amount_kobo');
            $table->string('payment_gateway')->nullable();
            $table->unsignedBigInteger('payment_gateway_fee_kobo')->nullable();
            // Signed — a loss-making transaction is still recorded honestly.
            $table->bigInteger('gross_profit_estimate_kobo')->nullable();
            $table->string('transaction_reference')->unique();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->timestamps();

            $table->index(['domain_id', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_financial_snapshots');
    }
};
