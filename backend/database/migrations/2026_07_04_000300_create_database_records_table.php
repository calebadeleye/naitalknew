<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('database_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->string('ispconfig_database_id')->nullable();
            $table->string('ispconfig_database_user_id')->nullable();
            $table->string('database_name');
            $table->string('username');
            $table->string('status')->default('provisioning');
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->unique(['hosting_service_id', 'database_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('database_records');
    }
};
