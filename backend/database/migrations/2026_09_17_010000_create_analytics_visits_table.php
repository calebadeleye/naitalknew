<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_visits', function (Blueprint $table): void {
            $table->id();
            $table->uuid('visitor_id');
            $table->string('entry_path', 500);
            $table->string('referrer', 500)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('country_code', 2)->nullable();
            $table->string('city', 150)->nullable();
            $table->string('ip_hash', 64)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('last_seen_at');
            $table->timestamps();

            $table->index('visitor_id');
            $table->index('started_at');
            $table->index('last_seen_at');
            $table->index('country');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_visits');
    }
};
