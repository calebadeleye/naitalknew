<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Email-only plans (plan_type "email"): Green Mail business email on the
 * client's own domain — registered with us, or anywhere else — with no
 * website. Provisioning creates only the mail domain (with DKIM); the
 * client gets the DNS records to add by email.
 */
return new class extends Migration
{
    private const PLANS = [
        ['Email Starter', 'email-starter', 5, 5, 12_000, 'Business email on your own domain for a small team: 5 mailboxes and 5 GB.', 1],
        ['Email Business', 'email-business', 20, 20, 30_000, 'Business email for a growing team: 20 mailboxes and 20 GB.', 2],
        ['Email Pro', 'email-pro', 50, 50, 60_000, 'Business email for larger teams: 50 mailboxes and 50 GB.', 3],
    ];

    public function up(): void
    {
        foreach (self::PLANS as [$name, $slug, $mailboxes, $storageGb, $annualNaira, $description, $order]) {
            if (DB::table('hosting_plans')->where('slug', $slug)->exists()) {
                continue;
            }

            $annualKobo = $annualNaira * 100;

            DB::table('hosting_plans')->insert([
                'name' => $name,
                'slug' => $slug,
                'plan_type' => 'email',
                'short_description' => $description,
                'monthly_price_kobo' => (int) round($annualKobo / 12),
                'annual_price_kobo' => $annualKobo,
                'setup_fee_kobo' => 0,
                'currency' => 'NGN',
                'storage_allocation' => $storageGb.'GB',
                'bandwidth_policy' => 'Email only — no website',
                'websites' => 0,
                'databases' => 0,
                'email_accounts' => $mailboxes,
                'backup_frequency' => 'none',
                'support_tier' => 'standard',
                'migration_included' => false,
                'is_featured' => $slug === 'email-business',
                'is_popular' => $slug === 'email-business',
                'is_recommended' => $slug === 'email-business',
                'is_active' => true,
                'is_public' => true,
                'is_orderable' => true,
                'status' => 'active',
                'sort_order' => 100 + $order,
                'display_badge' => $slug === 'email-business' ? 'Popular' : null,
                'cta_label' => 'Get business email',
                'internal_notes' => 'Email only: provisioning creates the ISPConfig client and mail domain (with DKIM), no website.',
                'public_features' => json_encode([
                    "{$mailboxes} mailboxes on your own domain",
                    "{$storageGb} GB of email storage, shared by your mailboxes",
                    'Green Mail: AI assistant, calendar, tasks, notes and templates',
                    'Works with phone and desktop mail apps (IMAP and SMTP)',
                    'Keep your domain where it is — or register one with us',
                    'Spam and virus filtering, DKIM signing',
                ]),
                'internal_limits' => json_encode(['business_emails' => $mailboxes, 'website' => false]),
                'configuration_json' => json_encode([
                    'website_enabled' => false,
                    'disk_quota_mb' => $storageGb * 1024,
                    'bandwidth_quota_mb' => 0,
                    'max_email_accounts' => $mailboxes,
                    'max_databases' => 0,
                    'max_ftp_accounts' => 0,
                    'ssh_access_enabled' => false,
                    'sftp_access_enabled' => false,
                    'ssl_enabled' => false,
                    'backup_enabled' => false,
                    'max_subdomains' => 0,
                    'max_aliases' => $mailboxes * 2,
                    'default_server_id' => 1,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Plans with services can't be deleted (restrictOnDelete); hide those instead.
        foreach (self::PLANS as [, $slug]) {
            $id = DB::table('hosting_plans')->where('slug', $slug)->value('id');

            if (! $id) {
                continue;
            }

            if (DB::table('hosting_services')->where('hosting_plan_id', $id)->exists()) {
                DB::table('hosting_plans')->where('id', $id)->update(['is_active' => false, 'is_public' => false, 'is_orderable' => false]);
            } else {
                DB::table('hosting_plans')->where('id', $id)->delete();
            }
        }
    }
};
