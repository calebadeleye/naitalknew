<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Greenmail (webmail). Mail itself stays on the mail server (IMAP); these
 * tables only hold signed-in sessions, each mailbox's contacts and its
 * display name / signature.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('greenmail_sessions', function (Blueprint $table): void {
            $table->id();
            $table->string('token_hash', 64)->unique();
            $table->string('email');
            // The mailbox password, encrypted with APP_KEY — IMAP/SMTP need it
            // on every request. Deleted on sign-out or expiry.
            $table->text('password_encrypted');
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('last_used_at');
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index('email');
        });

        Schema::create('greenmail_contacts', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('name')->nullable();
            $table->string('email');
            $table->string('phone', 60)->nullable();
            $table->string('company')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['owner_email', 'email']);
        });

        Schema::create('greenmail_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email')->unique();
            $table->string('display_name')->nullable();
            $table->text('signature_html')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_settings');
        Schema::dropIfExists('greenmail_contacts');
        Schema::dropIfExists('greenmail_sessions');
    }
};
