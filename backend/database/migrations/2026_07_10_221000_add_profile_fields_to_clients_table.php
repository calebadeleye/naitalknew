<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->string('state')->nullable()->after('country');
            $table->string('website')->nullable()->after('company_name');
            $table->string('industry')->nullable()->after('website');
            $table->string('support_email')->nullable()->after('industry');
            $table->string('company_size')->nullable()->after('support_email');
            // Defaults are applied in the Client model accessor, not here —
            // a null column means "use the defaults", so existing rows don't
            // need a backfill.
            $table->json('communication_preferences')->nullable()->after('metadata');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table): void {
            $table->dropColumn(['state', 'website', 'industry', 'support_email', 'company_size', 'communication_preferences']);
        });
    }
};
