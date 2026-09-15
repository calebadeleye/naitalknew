<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('naigrowth_messages', function (Blueprint $table): void {
            // The CRM write-back tool calls actually executed for this turn
            // (assistant rows only) — [{tool, args, summary}, ...].
            $table->json('actions_taken')->nullable()->after('facts_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('naigrowth_messages', function (Blueprint $table): void {
            $table->dropColumn('actions_taken');
        });
    }
};
