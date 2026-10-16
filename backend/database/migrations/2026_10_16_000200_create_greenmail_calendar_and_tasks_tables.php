<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Green Mail's calendar events and tasks — one set per mailbox. Times are stored in UTC. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('greenmail_events', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('title');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->boolean('all_day')->default(false);
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['owner_email', 'starts_at']);
        });

        Schema::create('greenmail_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('title');
            $table->date('due_date')->nullable();
            $table->boolean('done')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['owner_email', 'done', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_tasks');
        Schema::dropIfExists('greenmail_events');
    }
};
