<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Daily visitor figures per website, copied nightly from the site's own
 * AWStats report (which ISPConfig builds from the Apache access log), so the
 * client dashboard can chart them without opening AWStats.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_metrics_daily', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('visits')->default(0);
            $table->unsignedInteger('pages')->default(0);
            $table->unsignedInteger('hits')->default(0);
            $table->unsignedBigInteger('bandwidth_bytes')->default(0);
            $table->timestamps();

            $table->unique(['hosting_service_id', 'date']);
        });

        Schema::table('hosting_services', function (Blueprint $table): void {
            // Password for the site's /stats pages (ISPConfig user "admin"); encrypted.
            $table->text('stats_password')->nullable()->after('blocked_ips');
            $table->timestamp('stats_synced_at')->nullable()->after('stats_password');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_metrics_daily');

        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropColumn(['stats_password', 'stats_synced_at']);
        });
    }
};
