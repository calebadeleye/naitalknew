<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            // Structured "reason form" fields required before sensitive
            // client/service/website actions (suspend, deactivate, delete...).
            $table->string('reason_category', 60)->nullable()->after('reason');
            $table->boolean('notify_client')->default(true)->after('reason_category');
            $table->timestamp('effective_at')->nullable()->after('notify_client');
            $table->string('supporting_reference')->nullable()->after('effective_at');
            // 'admin' | 'system' | 'queue' | 'security' — who/what triggered this.
            $table->string('source', 20)->default('admin')->after('supporting_reference');
            $table->json('ispconfig_response')->nullable()->after('after_state');
            $table->text('error_details')->nullable()->after('ispconfig_response');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropColumn([
                'reason_category',
                'notify_client',
                'effective_at',
                'supporting_reference',
                'source',
                'ispconfig_response',
                'error_details',
            ]);
        });
    }
};
