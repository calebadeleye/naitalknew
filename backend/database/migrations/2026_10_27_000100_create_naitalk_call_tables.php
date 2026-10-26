<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('naitalk_call_tenants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->string('business_name');
            $table->string('contact_email')->nullable();
            $table->string('plan')->default('business');
            $table->unsignedInteger('monthly_price_usd_cents')->default(2000);
            // active | suspended | cancelled — only active tenants get keys and webhooks.
            $table->string('status')->default('active');
            // Rooms must be named "<room_prefix>-…" so webhooks and usage reach the right business.
            $table->string('room_prefix')->unique();
            // "managed": Naitalk generated the key and the sync script writes it to livekit.yaml.
            // "server": the key already sits in livekit.yaml outside the managed block (Cradle's).
            $table->string('key_source')->default('managed');
            $table->string('api_key')->nullable()->unique();
            $table->text('api_secret')->nullable();
            $table->string('webhook_url')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('naitalk_call_usage_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('naitalk_call_tenants')->cascadeOnDelete();
            $table->string('event_id')->unique();
            $table->string('room_name');
            $table->string('participant_identity')->nullable();
            $table->unsignedInteger('seconds');
            $table->timestamp('left_at');
            $table->timestamps();
            $table->index(['tenant_id', 'left_at']);
        });

        // Cradle is the first customer. Its key was made by the install script
        // and stays only on the server, so it is recorded as "server".
        DB::table('naitalk_call_tenants')->insert([
            'business_name' => 'Cradle',
            'plan' => 'business',
            'monthly_price_usd_cents' => 2000,
            'status' => 'active',
            'room_prefix' => 'cradle',
            'key_source' => 'server',
            'webhook_url' => 'http://127.0.0.1:4300/v1/calls/webhook',
            'notes' => 'First customer. Key lives in /etc/naitalk-call/livekit.yaml and /home/cradle/app/.env.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('naitalk_call_usage_events');
        Schema::dropIfExists('naitalk_call_tenants');
    }
};
