<?php

use Database\Seeders\HostingPlanSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data migration: moves the live Website Care catalogue to the four annual
 * plans (Starter ₦25,000, Business ₦50,000, Professional ₦100,000, Premium
 * ₦180,000) with fixed storage and unlimited business email accounts, and
 * brings the FAQ / knowledge-base wording in line. Plans come from the
 * database, so a code deploy alone would not change what visitors see.
 *
 * Idempotent: the seeder upserts by slug, and the copy edits only touch rows
 * that still contain the old text.
 */
return new class extends Migration
{
    public function up(): void
    {
        (new HostingPlanSeeder())->run();

        $faqAnswers = [
            'What is Website Care?' => 'An annual plan that bundles hosting, security, backups, unlimited professional business email accounts, and support — so your website stays online, safe, and looked after without you needing any technical knowledge.',
            'Which Website Care plan should I choose?' => 'Starter suits a simple single-site business, Business (our most popular) suits growing businesses that want security monitoring and priority support, Professional suits businesses running up to three websites, and Premium suits businesses running up to five websites that want the most frequent checks and hands-on support. Every plan includes unlimited professional business email accounts.',
            'Can I pay monthly?' => 'Website Care plans are billed annually, so your website, email and support stay covered all year without monthly renewals to remember.',
            'Is business email included in Website Care Plans?' => "Yes. Every plan includes unlimited professional business email accounts. Storage is subject to your plan's allocated resources and fair-use/server policies.",
            'Is support included in my plan?' => 'Yes, every Website Care plan includes support, with priority response times on the Business, Professional and Premium plans.',
        ];

        foreach ($faqAnswers as $question => $answer) {
            DB::table('faqs')->where('question', $question)->update(['answer' => $answer]);
        }

        $article = DB::table('knowledge_base_articles')->where('slug', 'how-to-order-hosting-and-manage-services')->first();

        if ($article) {
            DB::table('knowledge_base_articles')->where('id', $article->id)->update([
                'content' => str_replace('select monthly or annual billing, and add', 'choose annual billing, and add', $article->content),
            ]);
        }
    }

    public function down(): void
    {
        // Data migration; the previous catalogue is not restored.
    }
};
