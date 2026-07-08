<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hosting_usage_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('disk_used_mb')->default(0);
            $table->unsignedInteger('disk_quota_mb')->default(0);
            $table->unsignedInteger('bandwidth_used_mb')->default(0);
            $table->unsignedInteger('bandwidth_quota_mb')->default(0);
            $table->unsignedInteger('email_accounts_used')->default(0);
            $table->unsignedInteger('email_accounts_limit')->default(0);
            $table->unsignedInteger('databases_used')->default(0);
            $table->unsignedInteger('databases_limit')->default(0);
            $table->unsignedInteger('ftp_accounts_used')->default(0);
            $table->unsignedInteger('ftp_accounts_limit')->default(0);
            $table->boolean('ssh_sftp_enabled')->default(false);
            $table->timestamp('captured_at');
            $table->string('source')->default('scheduled_sync');
            $table->timestamps();

            $table->index(['hosting_service_id', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hosting_usage_snapshots');
    }
};
