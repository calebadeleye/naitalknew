<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domain_transfers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('domain_id')->nullable()->constrained('domains')->nullOnDelete();
            $table->string('domain_name');
            $table->string('provider')->default('spaceship');
            // Laravel `encrypted` cast — ciphertext at rest, never the raw EPP/auth code.
            $table->text('epp_code_encrypted');
            // transfer_pending_payment | transfer_initiated | transfer_pending_approval |
            // transfer_in_progress | transfer_completed | transfer_failed | transfer_cancelled
            $table->string('transfer_status')->default('transfer_pending_payment');
            $table->string('provider_transfer_id')->nullable();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->timestamp('initiated_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('transfer_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domain_transfers');
    }
};
