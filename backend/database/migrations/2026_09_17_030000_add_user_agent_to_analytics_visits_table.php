<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analytics_visits', function (Blueprint $table): void {
            $table->string('user_agent', 500)->nullable()->after('referrer');
        });
    }

    public function down(): void
    {
        Schema::table('analytics_visits', function (Blueprint $table): void {
            $table->dropColumn('user_agent');
        });
    }
};
