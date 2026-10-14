<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The IP addresses a client (or an admin) has blocked from a website. This
 * list is what was asked for; ISPConfig's apache_directives only mirror it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->json('blocked_ips')->nullable()->after('website_proxy_checked_at');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropColumn('blocked_ips');
        });
    }
};
