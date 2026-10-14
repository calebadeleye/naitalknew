<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Proof of consent: one row each time someone ticks "I agree to the Terms of
 * Service" — at sign-up, at hosting checkout and before a domain order —
 * recording which version they agreed to, when, and from where.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('terms_acceptances', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->string('version', 40);
            $table->string('context', 40);
            $table->string('reference')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('accepted_at');
            $table->timestamps();

            $table->index(['client_id', 'accepted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('terms_acceptances');
    }
};
