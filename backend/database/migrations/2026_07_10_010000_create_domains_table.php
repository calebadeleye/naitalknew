<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domains', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('domain_name');
            $table->string('tld', 30);
            // spaceship_registered | spaceship_transferred | external | manual
            $table->string('source');
            $table->string('provider')->default('spaceship');
            $table->string('provider_domain_id')->nullable();
            // Customer-facing lifecycle: pending | active | suspended | expired | cancelled
            $table->string('status')->default('pending');
            // pending_payment | payment_confirmed | registration_pending | registered |
            // registration_failed | expired | renewal_due | cancelled
            $table->string('registration_status')->nullable();
            // Mirrors the latest domain_transfers.transfer_status, nullable when not applicable.
            $table->string('transfer_status')->nullable();
            $table->date('registered_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->boolean('auto_renew')->default(true);
            $table->foreignId('linked_hosting_service_id')->nullable()->constrained('hosting_services')->nullOnDelete();
            $table->timestamps();

            $table->unique(['client_id', 'domain_name']);
            $table->index('expires_at');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domains');
    }
};
