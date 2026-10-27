<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // One row per usage alert sent, so each level goes out once a month.
    public function up(): void
    {
        Schema::create('naitalk_call_usage_alerts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('naitalk_call_tenants')->cascadeOnDelete();
            $table->string('period', 7); // Y-m
            $table->unsignedSmallInteger('level'); // 80 | 100
            $table->string('recipient');
            $table->timestamps();
            $table->unique(['tenant_id', 'period', 'level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('naitalk_call_usage_alerts');
    }
};
