<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mailbox_records', function (Blueprint $table): void {
            $table->string('source', 30)->default('provisioned')->after('ispconfig_mailbox_id');
            $table->timestamp('imported_at')->nullable()->after('last_synced_at');
        });

        Schema::table('database_records', function (Blueprint $table): void {
            $table->string('source', 30)->default('provisioned')->after('ispconfig_database_user_id');
            $table->timestamp('imported_at')->nullable()->after('last_synced_at');
        });
    }

    public function down(): void
    {
        Schema::table('mailbox_records', function (Blueprint $table): void {
            $table->dropColumn(['source', 'imported_at']);
        });

        Schema::table('database_records', function (Blueprint $table): void {
            $table->dropColumn(['source', 'imported_at']);
        });
    }
};
