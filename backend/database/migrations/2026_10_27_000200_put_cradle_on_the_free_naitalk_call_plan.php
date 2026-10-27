<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // Cradle is not charged for calls yet: it tests on the free plan.
    public function up(): void
    {
        DB::table('naitalk_call_tenants')
            ->where('room_prefix', 'cradle')
            ->where('plan', 'business')
            ->update(['plan' => 'free', 'monthly_price_usd_cents' => 0, 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('naitalk_call_tenants')
            ->where('room_prefix', 'cradle')
            ->where('plan', 'free')
            ->update(['plan' => 'business', 'monthly_price_usd_cents' => 2000, 'updated_at' => now()]);
    }
};
