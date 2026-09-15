<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('naigrowth_email_drafts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('naigrowth_message_id')->nullable()->constrained('naigrowth_messages')->nullOnDelete();
            $table->string('recipient_email');
            $table->string('recipient_name')->nullable();
            // lead | client | custom
            $table->string('recipient_type')->nullable();
            $table->unsignedBigInteger('recipient_id')->nullable();
            $table->string('subject');
            $table->text('body');
            // pending_review | sent | discarded
            $table->string('status')->default('pending_review');
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('naigrowth_email_drafts');
    }
};
