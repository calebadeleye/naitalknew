<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Green Mail: phone/desktop notifications (Web Push), self-service password
 * change, and password recovery by a verified recovery email.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('greenmail_push_subscriptions', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            // The device's sign-in; signing out there stops its notifications.
            $table->foreignId('session_id')->nullable()->constrained('greenmail_sessions')->nullOnDelete();
            $table->string('endpoint_hash', 64);
            $table->text('endpoint');
            $table->string('public_key');
            $table->string('auth_token');
            // Checking for new mail needs the mailbox password; kept encrypted, deleted with the subscription.
            $table->text('password_encrypted');
            $table->string('domain')->nullable();
            $table->unsignedBigInteger('last_uid')->default(0);
            $table->timestamp('last_notified_at')->nullable();
            $table->unsignedSmallInteger('failures')->default(0);
            $table->timestamps();

            // One device can get notifications for several signed-in mailboxes.
            $table->unique(['endpoint_hash', 'owner_email']);
            $table->index('owner_email');
        });

        Schema::table('greenmail_sessions', function (Blueprint $table): void {
            // Just after a password change, briefly accept the old one too (mail server caches).
            $table->text('previous_password_encrypted')->nullable();
            $table->timestamp('password_changed_at')->nullable();
        });

        Schema::table('greenmail_settings', function (Blueprint $table): void {
            $table->string('recovery_email')->nullable();
            $table->timestamp('recovery_email_verified_at')->nullable();
        });

        Schema::create('greenmail_codes', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('purpose', 20); // reset | verify_recovery
            $table->string('target')->nullable(); // the recovery email being verified
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();

            $table->index(['owner_email', 'purpose']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_codes');
        Schema::table('greenmail_settings', fn (Blueprint $table) => $table->dropColumn(['recovery_email', 'recovery_email_verified_at']));
        Schema::table('greenmail_sessions', fn (Blueprint $table) => $table->dropColumn(['previous_password_encrypted', 'password_changed_at']));
        Schema::dropIfExists('greenmail_push_subscriptions');
    }
};
