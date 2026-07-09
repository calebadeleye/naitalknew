<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            // Lets the admin dashboard attribute paid revenue to a specific
            // hosting service (for the grouped services dashboard) instead
            // of only to a client/order.
            $table->foreignId('hosting_service_id')->nullable()->after('order_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('hosting_service_id');
        });
    }
};
