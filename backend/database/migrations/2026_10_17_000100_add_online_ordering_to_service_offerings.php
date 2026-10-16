<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Service offerings that can be bought online on their own (paid by invoice,
 * then our team reaches out to set it up) — starting with SSL certificates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_offerings', function (Blueprint $table): void {
            $table->boolean('is_orderable')->default(false)->after('is_quote_only');
            $table->boolean('requires_domain')->default(false)->after('is_orderable');
        });

        if (! DB::table('service_offerings')->where('slug', 'ssl-certificate')->exists()) {
            DB::table('service_offerings')->insert([
                'name' => 'SSL Certificate',
                'slug' => 'ssl-certificate',
                'category' => 'security',
                'short_description' => 'Secure your website with HTTPS and the padlock in the browser. After you order, our team will reach out to you to set it up on your website.',
                'benefits' => json_encode([
                    'HTTPS and the browser padlock on your website',
                    'Encrypts forms, logins and payments on your site',
                    'Removes the “Not secure” warning in browsers',
                    'Helps your website rank and be trusted on Google',
                    'Valid for one year',
                    'Our team reaches out after you order and sets it up for you',
                ]),
                'price_kobo' => 1500000,
                'billing_type' => 'yearly',
                'is_quote_only' => false,
                'is_orderable' => true,
                'requires_domain' => true,
                'is_active' => true,
                'sort_order' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('service_offerings')->where('slug', 'ssl-certificate')->delete();

        Schema::table('service_offerings', function (Blueprint $table): void {
            $table->dropColumn(['is_orderable', 'requires_domain']);
        });
    }
};
