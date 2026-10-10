<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every question asked of the client-area help assistant, and whether the
 * knowledge base could answer it — so the questions it could NOT answer show
 * exactly which articles are missing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('help_assistant_questions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->text('question');
            $table->boolean('answered_from_knowledge_base')->default(false);
            $table->json('article_slugs')->nullable();
            // true when the AI model was unavailable and a plain keyword search answered instead
            $table->boolean('used_fallback')->default(false);
            $table->timestamps();

            // Explicit name: the generated one exceeds MySQL's 64-character identifier limit.
            $table->index(['answered_from_knowledge_base', 'created_at'], 'help_questions_answered_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('help_assistant_questions');
    }
};
