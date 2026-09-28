<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cached, ISPConfig-derived summary of a website's PHP/SSL/reverse-proxy
 * settings, so the dashboard and manage page never need a live ISPConfig
 * call just to render. ISPConfig itself stays the source of truth: these
 * columns are only ever written right after a live read from it (on the
 * client's Website tab, after a client-made change, or the periodic
 * technical sync), never the other way round.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->boolean('website_php_enabled')->default(false)->after('ispconfig_active');
            $table->boolean('website_ssl_active')->default(false)->after('website_php_enabled');
            $table->string('website_ssl_mode')->nullable()->after('website_ssl_active');
            $table->boolean('website_reverse_proxy_enabled')->default(false)->after('website_ssl_mode');
            $table->unsignedInteger('website_reverse_proxy_port')->nullable()->after('website_reverse_proxy_enabled');
            $table->timestamp('website_settings_synced_at')->nullable()->after('website_reverse_proxy_port');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropColumn([
                'website_php_enabled',
                'website_ssl_active',
                'website_ssl_mode',
                'website_reverse_proxy_enabled',
                'website_reverse_proxy_port',
                'website_settings_synced_at',
            ]);
        });
    }
};
