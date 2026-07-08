<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mailbox_records', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->string('ispconfig_mailbox_id')->nullable();
            $table->string('email_address');
            $table->string('display_name')->nullable();
            $table->unsignedInteger('quota_mb')->default(0);
            $table->string('status')->default('provisioning');
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->unique(['hosting_service_id', 'email_address']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mailbox_records');
    }
};
