<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ftp_account_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->string('ispconfig_ftp_user_id')->nullable();
            $table->string('username');
            $table->string('access_type')->default('ftp');
            $table->string('status')->default('provisioning');
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->unique(['hosting_service_id', 'username']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ftp_account_records');
    }
};
