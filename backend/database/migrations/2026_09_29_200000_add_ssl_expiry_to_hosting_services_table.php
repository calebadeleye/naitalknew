<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->timestamp('website_ssl_expires_at')->nullable()->after('website_ssl_active');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->dropColumn('website_ssl_expires_at');
        });
    }
};
