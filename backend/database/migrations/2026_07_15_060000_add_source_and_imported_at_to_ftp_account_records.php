<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ftp_account_records', function (Blueprint $table): void {
            $table->string('source', 30)->default('provisioned')->after('ispconfig_ftp_user_id');
            $table->timestamp('imported_at')->nullable()->after('last_synced_at');
        });
    }

    public function down(): void
    {
        Schema::table('ftp_account_records', function (Blueprint $table): void {
            $table->dropColumn(['source', 'imported_at']);
        });
    }
};
