<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('faqs', function (Blueprint $table): void {
            $table->id();
            // Free-text group label (Domains, Hosting, Website Care, Payments,
            // Wallet, Support, Website Design, Email) — kept as a plain string
            // rather than a foreign key since it's just a display grouping.
            $table->string('group');
            $table->string('question');
            $table->text('answer');
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status')->default('published');
            $table->timestamps();

            $table->index(['status', 'group']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faqs');
    }
};
