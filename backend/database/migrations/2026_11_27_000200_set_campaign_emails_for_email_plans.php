<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Campaign emails a month for the email-only plans (owner's numbers, 2026-11-27). */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['email-starter' => 500, 'email-business' => 2000, 'email-pro' => 5000] as $slug => $emails) {
            DB::table('hosting_plans')->where('slug', $slug)->update(['campaign_emails_monthly' => $emails]);
        }
    }

    public function down(): void
    {
        DB::table('hosting_plans')->whereIn('slug', ['email-starter', 'email-business', 'email-pro'])->update(['campaign_emails_monthly' => null]);
    }
};
