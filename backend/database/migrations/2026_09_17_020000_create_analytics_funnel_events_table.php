<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_funnel_events', function (Blueprint $table): void {
            $table->id();
            $table->uuid('visitor_id');
            $table->string('funnel', 50);
            $table->string('event_name', 50);
            $table->json('properties')->nullable();
            $table->unsignedBigInteger('value_kobo')->nullable();
            $table->timestamps();

            $table->index(['funnel', 'event_name']);
            $table->index('visitor_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_funnel_events');
    }
};
