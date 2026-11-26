<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Campaign emails: a free allowance each month by hosting plan, then prepaid
 * credit packs (valid 12 months). See App\Services\Greenmail\CampaignQuota.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_plans', function (Blueprint $table): void {
            $table->unsignedInteger('campaign_emails_monthly')->nullable();
        });

        foreach ([
            'starter-website-care' => 500,
            'legacy-hosting-ssl' => 500, // legacy hosting gets the Starter allowance
            'professional-email' => 500,
            'business-website-care' => 2000,
            'professional-website-care' => 5000,
            'premium-website-care' => 5000,
        ] as $slug => $emails) {
            DB::table('hosting_plans')->where('slug', $slug)->update(['campaign_emails_monthly' => $emails]);
        }

        // Which part of the allowance paid for each email: the month's free emails, or a credit.
        Schema::table('greenmail_campaign_recipients', function (Blueprint $table): void {
            $table->string('charged_to', 10)->nullable()->after('sent_at'); // plan | credit | free
        });

        // Prepaid credits per domain, used oldest-expiring first.
        Schema::create('greenmail_campaign_credits', function (Blueprint $table): void {
            $table->id();
            $table->string('domain');
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->unsignedInteger('amount');
            $table->unsignedInteger('remaining');
            $table->string('source', 20); // purchase | grant
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['domain', 'expires_at']);
            $table->unique('payment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_campaign_credits');
        Schema::table('greenmail_campaign_recipients', function (Blueprint $table): void {
            $table->dropColumn('charged_to');
        });
        Schema::table('hosting_plans', function (Blueprint $table): void {
            $table->dropColumn('campaign_emails_monthly');
        });
    }
};
