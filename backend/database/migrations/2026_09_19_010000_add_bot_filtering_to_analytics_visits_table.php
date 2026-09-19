<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analytics_visits', function (Blueprint $table): void {
            $table->boolean('engagement_tracked')->default(false)->after('device_type');
            $table->timestamp('engaged_at')->nullable()->after('engagement_tracked');
            $table->string('suspected_bot_reason', 60)->nullable()->after('engaged_at');
            $table->string('network', 150)->nullable()->after('suspected_bot_reason');
        });
    }

    public function down(): void
    {
        Schema::table('analytics_visits', function (Blueprint $table): void {
            $table->dropColumn(['engagement_tracked', 'engaged_at', 'suspected_bot_reason', 'network']);
        });
    }
};
