<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Campaign reports: opens, link clicks and unsubscribes per recipient and per link. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('greenmail_campaigns', function (Blueprint $table): void {
            $table->boolean('track')->default(true)->after('body_html');
        });

        Schema::table('greenmail_campaign_recipients', function (Blueprint $table): void {
            $table->timestamp('opened_at')->nullable()->after('sent_at');
            $table->unsignedInteger('open_count')->default(0)->after('opened_at');
            $table->timestamp('clicked_at')->nullable()->after('open_count');
            $table->unsignedInteger('click_count')->default(0)->after('clicked_at');
            $table->timestamp('unsubscribed_at')->nullable()->after('click_count');
        });

        Schema::create('greenmail_campaign_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campaign_id')->constrained('greenmail_campaigns')->cascadeOnDelete();
            $table->char('url_hash', 64);
            $table->text('url');
            $table->unsignedInteger('clicks')->default(0);
            $table->timestamps();

            $table->unique(['campaign_id', 'url_hash']);
        });

        Schema::create('greenmail_campaign_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('campaign_id')->constrained('greenmail_campaigns')->cascadeOnDelete();
            $table->foreignId('recipient_id')->constrained('greenmail_campaign_recipients')->cascadeOnDelete();
            $table->string('type', 10); // open | click
            $table->foreignId('link_id')->nullable()->constrained('greenmail_campaign_links')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['campaign_id', 'type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_campaign_events');
        Schema::dropIfExists('greenmail_campaign_links');
        Schema::table('greenmail_campaign_recipients', function (Blueprint $table): void {
            $table->dropColumn(['opened_at', 'open_count', 'clicked_at', 'click_count', 'unsubscribed_at']);
        });
        Schema::table('greenmail_campaigns', function (Blueprint $table): void {
            $table->dropColumn('track');
        });
    }
};
