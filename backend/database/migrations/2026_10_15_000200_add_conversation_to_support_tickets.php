<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turns support_tickets (until now only a list with a "latest_message") into
 * real conversations: who opened it, a category, who spoke last, and a
 * messages table with optional attachments.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('client_id')->constrained()->nullOnDelete();
            $table->string('category', 30)->default('technical')->after('subject');
            $table->string('last_reply_by', 10)->nullable()->after('latest_message');
            $table->timestamp('last_reply_at')->nullable()->after('last_reply_by');
            $table->timestamp('closed_at')->nullable()->after('last_reply_at');
        });

        Schema::create('support_ticket_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('author_type', 10);
            $table->text('body');
            $table->json('attachments')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_messages');

        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['category', 'last_reply_by', 'last_reply_at', 'closed_at']);
        });
    }
};
