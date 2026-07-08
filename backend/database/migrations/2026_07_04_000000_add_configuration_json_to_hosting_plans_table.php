<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_plans', function (Blueprint $table): void {
            if (! Schema::hasColumn('hosting_plans', 'configuration_json')) {
                $table->json('configuration_json')->nullable()->after('internal_notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hosting_plans', function (Blueprint $table): void {
            if (Schema::hasColumn('hosting_plans', 'configuration_json')) {
                $table->dropColumn('configuration_json');
            }
        });
    }
};
