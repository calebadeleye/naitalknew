<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // Toggle only for now — this is a stored preference, not an
            // enforced second factor at login. Real TOTP enforcement (secret,
            // QR setup, verification step, recovery codes) is a separate,
            // larger security feature.
            $table->boolean('two_factor_enabled')->default(false)->after('account_status');
            $table->boolean('login_alerts_enabled')->default(true)->after('two_factor_enabled');
            $table->string('last_login_ip')->nullable()->after('last_login_at');
            $table->string('last_login_user_agent')->nullable()->after('last_login_ip');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['two_factor_enabled', 'login_alerts_enabled', 'last_login_ip', 'last_login_user_agent']);
        });
    }
};
