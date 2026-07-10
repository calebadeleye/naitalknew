<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('domain_id')->nullable()->constrained('domains')->nullOnDelete();
            // Not in the originally suggested schema — added so an order can be traced
            // back without joining on domain_name strings (see plan's "Two intentional
            // additions" note).
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('hosting_service_id')->nullable()->constrained('hosting_services')->nullOnDelete();
            $table->string('domain_name');
            // registration | transfer | renewal
            $table->string('order_type');
            $table->string('provider')->default('spaceship');
            $table->string('provider_reference')->nullable();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            // pending_payment | payment_confirmed | processing | completed | failed
            $table->string('status')->default('pending_payment');
            $table->unsignedBigInteger('price_kobo')->default(0);
            $table->unsignedBigInteger('vat_amount_kobo')->default(0);
            $table->unsignedBigInteger('total_amount_kobo')->default(0);
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['status', 'order_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_orders');
    }
};
