<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hosting_plans', function (Blueprint $table): void {
            $table->string('currency', 3)->default('NGN')->after('setup_fee_kobo');
            $table->boolean('is_popular')->default(false)->after('is_featured');
            $table->boolean('is_recommended')->default(false)->after('is_popular');
            $table->string('display_badge')->nullable()->after('sort_order');
            $table->string('cta_label')->nullable()->after('display_badge');
            // Distinct from is_active: lets us mark a retired plan as
            // "deprecated" (kept for existing subscriptions) instead of just
            // toggling a boolean, without touching the is_active behaviour
            // that CheckoutService/CatalogController already depend on.
            $table->string('status', 20)->default('active')->after('is_active');
            $table->json('public_features')->nullable()->after('internal_notes');
            $table->json('internal_limits')->nullable()->after('public_features');
        });
    }

    public function down(): void
    {
        Schema::table('hosting_plans', function (Blueprint $table): void {
            $table->dropColumn([
                'currency',
                'is_popular',
                'is_recommended',
                'display_badge',
                'cta_label',
                'status',
                'public_features',
                'internal_limits',
            ]);
        });
    }
};
