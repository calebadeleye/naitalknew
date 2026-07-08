<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'account_status')) {
                $table->string('account_status')->default('pending_verification')->after('role');
            }

            if (! Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')->nullable()->after('remember_token');
            }
        });

        Schema::table('clients', function (Blueprint $table): void {
            if (! Schema::hasColumn('clients', 'account_type')) {
                $table->string('account_type')->default('registered_user')->index()->after('company_name');
            }

            if (! Schema::hasColumn('clients', 'client_status')) {
                $table->string('client_status')->default('active')->index()->after('account_type');
            }

            if (! Schema::hasColumn('clients', 'billing_address')) {
                $table->text('billing_address')->nullable()->after('billing_phone');
            }

            if (! Schema::hasColumn('clients', 'internal_notes')) {
                $table->text('internal_notes')->nullable()->after('country');
            }

            if (! Schema::hasColumn('clients', 'last_activity_at')) {
                $table->timestamp('last_activity_at')->nullable()->after('internal_notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            foreach (['last_activity_at', 'internal_notes', 'billing_address', 'client_status', 'account_type'] as $column) {
                if (Schema::hasColumn('clients', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('users', function (Blueprint $table): void {
            foreach (['last_login_at', 'account_status'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
