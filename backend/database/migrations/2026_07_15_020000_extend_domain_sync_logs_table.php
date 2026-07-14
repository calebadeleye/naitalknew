<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the existing domain_sync_logs table (already provider-parameterized,
 * already strips secrets, already one row per API call) to also serve as the
 * registrar sync log the Cloudflare integration needs, rather than creating a
 * duplicate table. `action` already accepts arbitrary values — the new
 * operations (full_sync, single_sync, registration, transfer, renewal,
 * auto_renew_update, ownership_assignment) are just added alongside
 * Spaceship's existing action values, no schema change needed for that part.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('domain_sync_logs', function (Blueprint $table): void {
            $table->unsignedSmallInteger('response_code')->nullable()->after('request_reference');
            $table->json('changes')->nullable()->after('response_summary');
            $table->timestamp('started_at')->nullable()->after('changes');
            $table->timestamp('completed_at')->nullable()->after('started_at');
        });
    }

    public function down(): void
    {
        Schema::table('domain_sync_logs', function (Blueprint $table): void {
            $table->dropColumn(['response_code', 'changes', 'started_at', 'completed_at']);
        });
    }
};
