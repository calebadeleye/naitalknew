<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_statuses', function (Blueprint $table): void {
            $table->id();
            $table->string('service_name')->unique();
            // operational | degraded | maintenance | incident
            $table->string('status')->default('operational');
            $table->string('message')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_statuses');
    }
};
