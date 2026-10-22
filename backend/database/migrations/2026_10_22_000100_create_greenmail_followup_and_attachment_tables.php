<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Green Mail follow-ups (snooze, "remind me if nobody replies"), the
 * attachment manager's index and secure share links, and tasks made from an
 * email. Snoozes and reminders keep the mailbox password encrypted until they
 * are done, like "Send later" emails.
 */
return new class extends Migration
{
    public function up(): void
    {
        // A snoozed email sits in the mailbox's "Snoozed" folder until `until`,
        // then goes back to its folder as unread. Found again by Message-ID
        // (moving an email gives it a new UID).
        Schema::create('greenmail_snoozes', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->text('password_encrypted')->nullable();
            $table->string('message_id', 500);
            $table->string('subject')->nullable();
            $table->string('from_email')->nullable();
            $table->string('return_folder', 200);
            $table->timestamp('until');
            $table->string('status', 20)->default('snoozed'); // snoozed | returned | cancelled | failed
            $table->string('error')->nullable();
            $table->timestamps();

            $table->index(['status', 'until']);
            $table->index(['owner_email', 'status']);
        });

        // "Remind me if nobody replies": at remind_at the Inbox is searched for a
        // reply to message_id; none means the reminder is due.
        Schema::create('greenmail_followups', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->text('password_encrypted')->nullable();
            $table->string('message_id', 500);
            $table->string('subject')->nullable();
            $table->json('recipients')->nullable();
            $table->string('sent_folder', 200)->nullable();
            $table->timestamp('remind_at');
            $table->string('status', 20)->default('waiting'); // waiting | replied | due | dismissed | failed
            $table->timestamp('checked_at')->nullable();
            $table->string('error')->nullable();
            $table->timestamps();

            $table->index(['status', 'remind_at']);
            $table->index(['owner_email', 'status']);
        });

        // The attachment manager's index: one row per attachment, filled a batch
        // of messages at a time (folders scanned newest first).
        Schema::create('greenmail_attachments', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('folder', 200);
            $table->unsignedBigInteger('uid');
            $table->unsignedInteger('part_index');
            $table->string('message_id', 500)->nullable();
            $table->string('name');
            $table->string('extension', 20)->nullable();
            $table->string('kind', 20); // pdf | image | document | spreadsheet | presentation | archive | other
            $table->string('mime', 150)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('from_name')->nullable();
            $table->string('from_email')->nullable();
            $table->string('subject')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->string('warning')->nullable(); // why it may be dangerous; null when it looks fine
            $table->timestamps();

            $table->unique(['owner_email', 'folder', 'uid', 'part_index'], 'gm_attachments_unique');
            $table->index(['owner_email', 'kind', 'sent_at']);
        });

        Schema::create('greenmail_attachment_scans', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('folder', 200);
            $table->unsignedBigInteger('highest_uid')->default(0); // everything above this is indexed
            $table->unsignedBigInteger('lowest_uid')->nullable();  // older mail below this is still to do
            $table->boolean('complete')->default(false);
            $table->timestamps();

            $table->unique(['owner_email', 'folder']);
        });

        // A copy of one attachment behind an unguessable link that expires.
        Schema::create('greenmail_shared_files', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('token', 64)->unique();
            $table->string('name');
            $table->string('mime', 150)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('path');
            $table->unsignedInteger('downloads')->default(0);
            $table->unsignedInteger('max_downloads')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['owner_email', 'expires_at']);
        });

        Schema::table('greenmail_tasks', function (Blueprint $table): void {
            $table->string('source_folder', 200)->nullable()->after('notes');
            $table->string('source_message_id', 500)->nullable()->after('source_folder');
            $table->string('source_subject')->nullable()->after('source_message_id');
        });
    }

    public function down(): void
    {
        Schema::table('greenmail_tasks', function (Blueprint $table): void {
            $table->dropColumn(['source_folder', 'source_message_id', 'source_subject']);
        });
        Schema::dropIfExists('greenmail_shared_files');
        Schema::dropIfExists('greenmail_attachment_scans');
        Schema::dropIfExists('greenmail_attachments');
        Schema::dropIfExists('greenmail_followups');
        Schema::dropIfExists('greenmail_snoozes');
    }
};
