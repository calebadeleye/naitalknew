<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_assets', function (Blueprint $table): void {
            $table->id();
            $table->string('source')->default('pexels');
            $table->string('source_provider')->nullable();
            $table->string('source_id')->nullable();
            // The exact query + orientation this row answers — the cache key
            // PexelsImageService looks up before calling the real API.
            $table->string('cache_key')->unique();
            $table->string('url');
            $table->string('alt_text')->nullable();
            $table->string('photographer')->nullable();
            $table->string('provider_url')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_assets');
    }
};
