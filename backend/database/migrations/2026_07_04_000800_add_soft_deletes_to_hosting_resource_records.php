<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The composite unique index is the only index covering hosting_service_id,
        // so MySQL refuses to drop it while the foreign key depends on it — add a
        // plain index on the FK column first so the unique index can be dropped.
        Schema::table('mailbox_records', function (Blueprint $table): void {
            $table->index('hosting_service_id', 'mailbox_records_hosting_service_id_fk_index');
            $table->dropUnique(['hosting_service_id', 'email_address']);
            $table->softDeletes();
        });

        Schema::table('database_records', function (Blueprint $table): void {
            $table->index('hosting_service_id', 'database_records_hosting_service_id_fk_index');
            $table->dropUnique(['hosting_service_id', 'database_name']);
            $table->softDeletes();
        });

        Schema::table('ftp_account_records', function (Blueprint $table): void {
            $table->index('hosting_service_id', 'ftp_account_records_hosting_service_id_fk_index');
            $table->dropUnique(['hosting_service_id', 'username']);
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('mailbox_records', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->unique(['hosting_service_id', 'email_address']);
            $table->dropIndex('mailbox_records_hosting_service_id_fk_index');
        });

        Schema::table('database_records', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->unique(['hosting_service_id', 'database_name']);
            $table->dropIndex('database_records_hosting_service_id_fk_index');
        });

        Schema::table('ftp_account_records', function (Blueprint $table): void {
            $table->dropSoftDeletes();
            $table->unique(['hosting_service_id', 'username']);
            $table->dropIndex('ftp_account_records_hosting_service_id_fk_index');
        });
    }
};
