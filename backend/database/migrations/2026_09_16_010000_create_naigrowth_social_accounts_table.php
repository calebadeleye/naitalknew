<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'linkedin'];

    public function up(): void
    {
        Schema::create('naigrowth_social_accounts', function (Blueprint $table): void {
            $table->id();
            $table->string('platform')->unique();
            $table->string('display_name')->nullable();
            $table->string('external_account_id')->nullable();
            // Ciphertext at rest -- never serialized back to the frontend
            // (see NaiGrowthSocialAccount::$hidden), same treatment as
            // DomainTransfer::epp_code_encrypted.
            $table->text('access_token_encrypted')->nullable();
            // not_connected | connected
            $table->string('status')->default('not_connected');
            $table->foreignId('connected_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('connected_at')->nullable();
            // Populated once real metrics ingestion exists -- not built yet.
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });

        // One row per platform always exists so the admin UI and NaiGrowth's
        // context snapshot can show a stable "not connected" state without
        // conditional row-creation logic anywhere else.
        $now = now();
        DB::table('naigrowth_social_accounts')->insert(
            collect(self::PLATFORMS)->map(fn (string $platform) => [
                'platform' => $platform,
                'status' => 'not_connected',
                'created_at' => $now,
                'updated_at' => $now,
            ])->all()
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('naigrowth_social_accounts');
    }
};
