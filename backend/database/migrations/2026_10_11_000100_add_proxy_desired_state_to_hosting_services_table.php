<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The reverse proxy (client-run Node app) is the only thing that makes such a
 * site work: without its ProxyPass rule Apache serves the raw files in the web
 * folder instead of the app. `website_reverse_proxy_*` is a cache of what
 * ISPConfig currently says, so it is overwritten on every read — when the rule
 * silently vanished, the dashboard forgot a proxy had ever been set up.
 * `website_proxy_desired_port` is what the client ASKED for, written only by
 * their own save/remove, so drift can be detected and repaired.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->unsignedSmallInteger('website_proxy_desired_port')->nullable()->after('website_reverse_proxy_port');
            $table->string('website_proxy_health', 20)->nullable()->after('website_proxy_desired_port');
            $table->timestamp('website_proxy_checked_at')->nullable()->after('website_proxy_health');
        });

        // Sites already proxied are, by definition, ones whose client wants it.
        DB::table('hosting_services')
            ->where('website_reverse_proxy_enabled', true)
            ->whereNotNull('website_reverse_proxy_port')
            ->update(['website_proxy_desired_port' => DB::raw('website_reverse_proxy_port')]);
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropColumn(['website_proxy_desired_port', 'website_proxy_health', 'website_proxy_checked_at']);
        });
    }
};
