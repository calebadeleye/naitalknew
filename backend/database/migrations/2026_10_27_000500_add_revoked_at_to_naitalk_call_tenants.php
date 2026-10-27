<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A revoked key leaves livekit.yaml at the next sync; the app keeps its record and can get a new key.
    public function up(): void
    {
        Schema::table('naitalk_call_tenants', function (Blueprint $table): void {
            $table->timestamp('revoked_at')->nullable()->after('api_secret');
        });
    }

    public function down(): void
    {
        Schema::table('naitalk_call_tenants', function (Blueprint $table): void {
            $table->dropColumn('revoked_at');
        });
    }
};
