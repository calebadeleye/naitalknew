<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Optional admin overrides for the static marketing pages' SEO tags
     * (/domains, /web-hosting, etc). A missing row for a path just means
     * "use the page's built-in defaults" — this table only exists so an
     * admin can tweak SEO copy without a code deploy.
     */
    public function up(): void
    {
        Schema::create('page_seo_metadata', function (Blueprint $table): void {
            $table->id();
            $table->string('path')->unique();
            $table->string('seo_title')->nullable();
            $table->string('meta_description', 500)->nullable();
            $table->string('og_image')->nullable();
            $table->string('canonical_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('page_seo_metadata');
    }
};
