<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One hidden, backend-only SSH/SFTP account per hosting service, used solely
 * by the client dashboard's File Manager to broker file operations. The
 * client never sees these credentials — this is not the same thing as the
 * client-created SSH/SFTP accounts under Hosting > SSH/SFTP.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hosting_file_manager_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->unique()->constrained()->restrictOnDelete();
            $table->string('ispconfig_shell_user_id')->nullable();
            $table->string('username');
            $table->text('password');
            $table->string('status')->default('provisioning');
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hosting_file_manager_accounts');
    }
};
