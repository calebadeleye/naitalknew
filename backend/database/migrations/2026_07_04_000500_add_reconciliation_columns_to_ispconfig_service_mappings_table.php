<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ispconfig_service_mappings', function (Blueprint $table): void {
            if (! Schema::hasColumn('ispconfig_service_mappings', 'last_reconciled_at')) {
                $table->timestamp('last_reconciled_at')->nullable()->after('last_synced_at');
            }

            if (! Schema::hasColumn('ispconfig_service_mappings', 'last_error')) {
                $table->text('last_error')->nullable()->after('technical_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ispconfig_service_mappings', function (Blueprint $table): void {
            foreach (['last_reconciled_at', 'last_error'] as $column) {
                if (Schema::hasColumn('ispconfig_service_mappings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
