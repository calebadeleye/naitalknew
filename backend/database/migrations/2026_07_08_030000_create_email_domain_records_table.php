<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_domain_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->string('ispconfig_mail_domain_id')->nullable();
            $table->string('domain');
            $table->string('status')->default('active');
            // 'provisioned' (created through the app) vs 'ispconfig_import'
            // (discovered read-only from an existing ISPConfig install).
            $table->string('source', 30)->default('provisioned');
            $table->timestamp('imported_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['hosting_service_id', 'domain']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_domain_records');
    }
};
