<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('website_quote_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('reference')->unique();
            $table->string('name');
            $table->string('phone');
            $table->string('email');
            $table->string('website_type');
            $table->string('estimated_budget');
            $table->text('project_description');
            // new | contacted | qualified | quoted | converted | closed | spam
            $table->string('status')->default('new');
            $table->string('source')->nullable()->default('google_ads');
            $table->string('landing_page')->nullable();
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();
            $table->string('utm_term')->nullable();
            $table->string('utm_content')->nullable();
            $table->string('gclid')->nullable();
            $table->string('referrer')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('contacted_at')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('website_quote_requests');
    }
};
