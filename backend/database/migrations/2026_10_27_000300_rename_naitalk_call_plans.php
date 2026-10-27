<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // The $20 plan was called "business"; it is now Starter, and Business is $99.
    public function up(): void
    {
        DB::table('naitalk_call_tenants')->where('plan', 'business')->where('monthly_price_usd_cents', 2000)
            ->update(['plan' => 'starter', 'updated_at' => now()]);
    }

    public function down(): void
    {
        DB::table('naitalk_call_tenants')->where('plan', 'starter')->update(['plan' => 'business', 'updated_at' => now()]);
    }
};
