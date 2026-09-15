<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('naigrowth_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // user | assistant
            $table->string('role');
            $table->text('content');
            // The business-data snapshot fed to the model for this turn (assistant
            // rows only) — kept so replies stay auditable against what was FACT.
            $table->json('facts_snapshot')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('naigrowth_messages');
    }
};
