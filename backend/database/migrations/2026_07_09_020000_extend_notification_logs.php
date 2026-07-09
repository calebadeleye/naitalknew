<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_logs', function (Blueprint $table): void {
            $table->string('subject')->nullable()->after('template');
            $table->foreignId('hosting_service_id')->nullable()->after('client_id')->constrained()->nullOnDelete();
            $table->string('domain')->nullable()->after('hosting_service_id');
            $table->text('failure_reason')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('notification_logs', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('hosting_service_id');
            $table->dropColumn(['subject', 'domain', 'failure_reason']);
        });
    }
};
