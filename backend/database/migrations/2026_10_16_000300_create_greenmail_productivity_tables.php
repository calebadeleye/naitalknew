<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Green Mail notes, templates, mail rules (filters + automation), emails
 * scheduled to send later, and campaigns — one set per mailbox.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('greenmail_notes', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('title')->nullable();
            $table->text('body')->nullable();
            $table->string('color', 20)->nullable();
            $table->boolean('pinned')->default(false);
            $table->timestamps();

            $table->index(['owner_email', 'pinned', 'updated_at']);
        });

        Schema::create('greenmail_templates', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('name');
            $table->string('subject')->nullable();
            $table->mediumText('body_html')->nullable();
            $table->timestamps();

            $table->index('owner_email');
        });

        // Compiled into the mailbox's server-side Sieve script, so rules run
        // even when Green Mail isn't open.
        Schema::create('greenmail_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('kind', 20); // filter | automation
            $table->string('name');
            $table->string('field', 20); // any | from | to | subject
            $table->string('operator', 20)->default('contains'); // contains | is | begins | ends
            $table->string('value')->nullable();
            $table->string('action', 20); // move | delete | mark_read | star | forward | auto_reply
            $table->string('target')->nullable(); // folder, or the forwarding address
            $table->string('reply_subject')->nullable();
            $table->text('reply_text')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['owner_email', 'kind', 'position']);
        });

        Schema::create('greenmail_scheduled_messages', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->text('password_encrypted')->nullable(); // removed once sent or cancelled
            $table->string('subject')->nullable();
            $table->json('recipients');
            $table->string('raw_path'); // the composed message, on the local disk
            $table->dateTime('send_at');
            $table->string('status', 20)->default('scheduled'); // scheduled | sending | sent | failed | cancelled
            $table->string('error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'send_at']);
            $table->index('owner_email');
        });

        Schema::create('greenmail_campaigns', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->text('password_encrypted')->nullable(); // only while sending
            $table->string('name');
            $table->string('subject');
            $table->mediumText('body_html');
            $table->string('status', 20)->default('draft'); // draft | sending | sent | cancelled | failed
            $table->dateTime('send_at')->nullable();
            $table->unsignedInteger('total')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->string('last_error')->nullable();
            $table->timestamps();

            $table->index(['owner_email', 'created_at']);
            $table->index(['status', 'send_at']);
        });

        Schema::create('greenmail_campaign_recipients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campaign_id')->constrained('greenmail_campaigns')->cascadeOnDelete();
            $table->string('email');
            $table->string('name')->nullable();
            $table->string('status', 20)->default('pending'); // pending | sent | failed | skipped
            $table->string('error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique(['campaign_id', 'email']);
            $table->index(['campaign_id', 'status']);
        });

        Schema::create('greenmail_unsubscribes', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('email');
            $table->timestamps();

            $table->unique(['owner_email', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_unsubscribes');
        Schema::dropIfExists('greenmail_campaign_recipients');
        Schema::dropIfExists('greenmail_campaigns');
        Schema::dropIfExists('greenmail_scheduled_messages');
        Schema::dropIfExists('greenmail_rules');
        Schema::dropIfExists('greenmail_templates');
        Schema::dropIfExists('greenmail_notes');
    }
};
