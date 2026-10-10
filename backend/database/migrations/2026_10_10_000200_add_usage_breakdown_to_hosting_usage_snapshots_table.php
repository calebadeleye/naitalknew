<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A package's space covers website files, email and databases together, so
 * disk_used_mb is now their total and these columns keep the breakdown the
 * client sees. Null on snapshots taken before the breakdown existed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_usage_snapshots', function (Blueprint $table): void {
            $table->unsignedInteger('web_used_mb')->nullable()->after('disk_used_mb');
            $table->unsignedInteger('mail_used_mb')->nullable()->after('web_used_mb');
            $table->unsignedInteger('database_used_mb')->nullable()->after('mail_used_mb');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_usage_snapshots', function (Blueprint $table): void {
            $table->dropColumn(['web_used_mb', 'mail_used_mb', 'database_used_mb']);
        });
    }
};
