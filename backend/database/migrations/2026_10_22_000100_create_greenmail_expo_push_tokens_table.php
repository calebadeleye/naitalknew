<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Green Mail mobile app: phones that get "new mail" notifications through
 * Expo's push service (the web app uses Web Push instead).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('greenmail_expo_push_tokens', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->foreignId('session_id')->nullable()->constrained('greenmail_sessions')->nullOnDelete();
            $table->string('token', 255);
            $table->string('platform', 10)->nullable(); // ios | android
            // Checking for new mail needs the mailbox password; kept encrypted, deleted with the token.
            $table->text('password_encrypted');
            $table->unsignedBigInteger('last_uid')->default(0);
            $table->timestamp('last_notified_at')->nullable();
            $table->unsignedSmallInteger('failures')->default(0);
            $table->timestamps();

            // One phone can get notifications for several signed-in mailboxes.
            $table->unique(['token', 'owner_email']);
            $table->index('owner_email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_expo_push_tokens');
    }
};
