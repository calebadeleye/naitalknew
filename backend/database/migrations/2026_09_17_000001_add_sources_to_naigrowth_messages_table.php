<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('naigrowth_messages', function (Blueprint $table): void {
            // Google Search grounding sources cited for this turn's reply
            // (assistant rows only) — [{title, uri}, ...].
            $table->json('sources')->nullable()->after('actions_taken');
        });
    }

    public function down(): void
    {
        Schema::table('naigrowth_messages', function (Blueprint $table): void {
            $table->dropColumn('sources');
        });
    }
};
