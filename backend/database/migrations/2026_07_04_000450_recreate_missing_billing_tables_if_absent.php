<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Defensive repair migration: on this environment, ispconfig_client_mappings,
 * ispconfig_service_mappings, and audit_logs are missing even though
 * 2026_07_02_060000_create_hosting_billing_tables is recorded as having run
 * (their creation code is present and correct in that migration — something
 * external to Laravel dropped just these three tables without updating the
 * migrations table). This recreates them idempotently, matching the original
 * schema exactly, without touching any other table's data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ispconfig_client_mappings')) {
            Schema::create('ispconfig_client_mappings', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('client_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('ispconfig_server_id')->default(1);
                $table->string('ispconfig_client_id')->nullable();
                $table->timestamp('provisioned_at')->nullable();
                $table->string('sync_status')->default('not_provisioned')->index();
                $table->timestamp('last_synced_at')->nullable();
                $table->json('metadata_json')->nullable();
                $table->timestamps();
                $table->unique(['client_id', 'ispconfig_server_id']);
            });
        }

        if (! Schema::hasTable('ispconfig_service_mappings')) {
            Schema::create('ispconfig_service_mappings', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('ispconfig_server_id')->default(1);
                $table->foreignId('ispconfig_client_mapping_id')->constrained()->cascadeOnDelete();
                $table->string('ispconfig_website_id')->nullable();
                $table->string('ispconfig_mail_domain_id')->nullable();
                $table->string('ispconfig_database_id')->nullable();
                $table->string('ispconfig_ftp_user_id')->nullable();
                $table->string('technical_status')->default('awaiting_provisioning')->index();
                $table->timestamp('last_synced_at')->nullable();
                $table->json('metadata_json')->nullable();
                $table->timestamps();
                $table->unique(['hosting_service_id', 'ispconfig_server_id'], 'ispconfig_service_server_unique');
            });
        }

        if (! Schema::hasTable('audit_logs')) {
            Schema::create('audit_logs', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('staff_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('hosting_service_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
                $table->string('action');
                $table->text('reason')->nullable();
                $table->json('before_state')->nullable();
                $table->json('after_state')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        // Intentionally a no-op: this migration only repairs missing tables
        // that the original migration already owns dropping in its down().
    }
};
