<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->timestamp('suspended_at')->nullable()->after('last_activity_at');
            $table->timestamp('deactivated_at')->nullable()->after('suspended_at');
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->dropColumn(['suspended_at', 'deactivated_at']);
        });
    }
};
