<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Batch-run history for the TLD price sync job — distinct from
 * domain_sync_logs, which records individual Spaceship API calls
 * (availability/registration/transfer) rather than aggregate sync-run stats.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_pricing_sync_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('provider')->default('spaceship');
            // manual | scheduled
            $table->string('sync_type')->default('manual');
            // running | success | failed | partial
            $table->string('status')->default('running');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('total_tlds_found')->default(0);
            $table->unsignedInteger('total_tlds_created')->default(0);
            $table->unsignedInteger('total_tlds_updated')->default(0);
            $table->unsignedInteger('total_tlds_failed')->default(0);
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_pricing_sync_logs');
    }
};
