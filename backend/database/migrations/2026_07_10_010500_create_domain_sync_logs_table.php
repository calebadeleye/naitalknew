<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_sync_logs', function (Blueprint $table): void {
            $table->id();
            // Nullable — some operations (e.g. an availability search) happen before
            // any local Domain row exists.
            $table->foreignId('domain_id')->nullable()->constrained('domains')->nullOnDelete();
            $table->string('provider')->default('spaceship');
            $table->string('action');
            $table->string('status');
            $table->string('request_reference')->nullable();
            // Secrets are stripped before this is ever written — see SpaceshipClient.
            $table->json('response_summary')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['provider', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_sync_logs');
    }
};
