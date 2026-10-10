<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Services the automatic billing lifecycle must never touch — NAI TALK's own
 * websites and complimentary hosting: no renewal invoices, auto-charges,
 * expiry reminders, expiry, suspension or website deletion.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->boolean('lifecycle_exempt')->default(false)->after('auto_renew_enabled');
            $table->string('lifecycle_exempt_reason')->nullable()->after('lifecycle_exempt');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropColumn(['lifecycle_exempt', 'lifecycle_exempt_reason']);
        });
    }
};
