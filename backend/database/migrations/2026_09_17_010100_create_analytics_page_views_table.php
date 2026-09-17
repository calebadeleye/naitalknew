<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_page_views', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('analytics_visit_id')->constrained()->cascadeOnDelete();
            $table->string('path', 500);
            $table->string('title', 255)->nullable();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->timestamp('viewed_at');
            $table->timestamps();

            $table->index('path');
            $table->index('viewed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_page_views');
    }
};
