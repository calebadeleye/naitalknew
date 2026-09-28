<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Business Website Care: ₦60,000 a year for up to two websites (was ₦50,000
 * for one). Plans live in the database, so the seeder alone doesn't change
 * what visitors see. Only the price and website count are touched — anything
 * an admin has edited on the plan since stays as it is.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('hosting_plans')->where('slug', 'business-website-care')->update([
            'annual_price_kobo' => 6_000_000,
            // Internal only (annual / 12); monthly billing is no longer offered.
            'monthly_price_kobo' => 500_000,
            'websites' => 2,
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('hosting_plans')->where('slug', 'business-website-care')->update([
            'annual_price_kobo' => 5_000_000,
            'monthly_price_kobo' => 416_667,
            'websites' => 1,
            'updated_at' => now(),
        ]);
    }
};
