<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('software_installations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->string('catalog_slug');
            $table->string('status')->default('queued');
            $table->string('progress_step')->nullable();
            $table->string('subdomain');
            $table->string('install_path')->nullable();
            $table->unsignedInteger('node_port')->nullable();
            $table->unsignedTinyInteger('redis_db_index')->nullable();
            $table->unsignedTinyInteger('redis_cache_db_index')->nullable();
            $table->unsignedTinyInteger('redis_queue_db_index')->nullable();
            $table->string('admin_email')->nullable();
            $table->text('admin_password_shown_once')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamp('installed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['hosting_service_id', 'catalog_slug']);
            $table->unique('subdomain');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('software_installations');
    }
};
