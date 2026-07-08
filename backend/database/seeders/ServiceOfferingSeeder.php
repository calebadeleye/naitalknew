<?php

namespace Database\Seeders;

use App\Models\ServiceOffering;
use Illuminate\Database\Seeder;

class ServiceOfferingSeeder extends Seeder
{
    public function run(): void
    {
        $offerings = [
            [
                'name' => 'Business Website Development',
                'slug' => 'website-development',
                'category' => 'web_development',
                'short_description' => 'A custom-built, mobile-friendly business website designed to convert visitors into customers.',
                'benefits' => ['Custom design', 'Mobile responsive', 'SEO-ready structure', 'Content upload assistance'],
                'price_kobo' => 15000000,
                'billing_type' => 'one_time',
                'is_quote_only' => false,
                'sort_order' => 10,
            ],
            [
                'name' => 'Website Maintenance Plan',
                'slug' => 'website-maintenance',
                'category' => 'maintenance',
                'short_description' => 'Ongoing updates, backups, and security monitoring so your website keeps running smoothly.',
                'benefits' => ['Monthly updates', 'Uptime monitoring', 'Security patches', 'Priority support'],
                'price_kobo' => 2500000,
                'billing_type' => 'monthly',
                'is_quote_only' => false,
                'sort_order' => 20,
            ],
            [
                'name' => 'AI Chatbot & Automation',
                'slug' => 'ai-solutions',
                'category' => 'ai',
                'short_description' => 'AI-powered chatbots and workflow automation tailored to your business needs.',
                'benefits' => ['Custom conversation flows', 'Integrates with your website', 'Ongoing tuning support'],
                'price_kobo' => null,
                'billing_type' => 'custom_quote',
                'is_quote_only' => true,
                'sort_order' => 30,
            ],
            [
                'name' => 'Professional Email Add-on',
                'slug' => 'professional-email',
                'category' => 'email_addon',
                'short_description' => 'Branded @yourcompany.com email accounts with webmail and mobile access.',
                'benefits' => ['5 mailboxes included', 'Webmail + IMAP/SMTP', 'Spam filtering'],
                'price_kobo' => 500000,
                'billing_type' => 'monthly',
                'is_quote_only' => false,
                'sort_order' => 40,
            ],
            [
                'name' => 'Backup Add-on',
                'slug' => 'backup-addon',
                'category' => 'backup_addon',
                'short_description' => 'Daily off-site backups with one-click restore for your hosted website.',
                'benefits' => ['Daily automated backups', '30-day retention', 'One-click restore'],
                'price_kobo' => 300000,
                'billing_type' => 'monthly',
                'is_quote_only' => false,
                'sort_order' => 50,
            ],
        ];

        foreach ($offerings as $offering) {
            ServiceOffering::query()->updateOrCreate(['slug' => $offering['slug']], $offering);
        }
    }
}
