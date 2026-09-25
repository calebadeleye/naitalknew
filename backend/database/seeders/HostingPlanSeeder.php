<?php

namespace Database\Seeders;

use App\Models\HostingPlan;
use Illuminate\Database\Seeder;

/**
 * Seeds the four "Website Care" packages shown on the public pricing page,
 * plus one hidden internal package ("Legacy Hosting + SSL") used to hold
 * clients/websites imported read-only from ISPConfig until they're manually
 * migrated to a Website Care package. Safe to run repeatedly (updateOrCreate
 * keyed by slug) and safe to run against a database that still has the old
 * technical hosting-plan slugs — those are deactivated/deprecated in place
 * rather than deleted, because hosting_services.hosting_plan_id has a
 * restrictOnDelete() foreign key and existing subscriptions must never be
 * orphaned.
 */
class HostingPlanSeeder extends Seeder
{
    /**
     * Slugs used before the Website Care repositioning.
     */
    private const DEPRECATED_SLUGS = ['starter', 'business', 'professional', 'managed'];

    /**
     * @return array<string, HostingPlan> the seeded plans, keyed by slug
     */
    public function run(): array
    {
        HostingPlan::query()
            ->whereIn('slug', self::DEPRECATED_SLUGS)
            ->update(['is_active' => false, 'status' => 'deprecated']);

        $plans = [];

        foreach ($this->packages() as $package) {
            $plans[$package['slug']] = HostingPlan::query()->updateOrCreate(
                ['slug' => $package['slug']],
                $package
            );
        }

        $plans['legacy-hosting-ssl'] = HostingPlan::query()->updateOrCreate(
            ['slug' => 'legacy-hosting-ssl'],
            $this->legacyPackage()
        );

        return $plans;
    }

    /**
     * Annual prices are the only public prices. monthly_price_kobo is kept
     * (annual / 12, rounded) purely so legacy monthly-cycle services can
     * still renew; monthly is no longer offered at checkout or displayed.
     *
     * Business email is unlimited on every plan (accounts, not storage —
     * mailbox storage counts against the plan's disk allocation). It is
     * stored as HostingPlan::UNLIMITED_EMAIL_ACCOUNTS so the numeric
     * `max_email_accounts` enforcement keeps working unchanged.
     *
     * @return array<int, array<string, mixed>>
     */
    private function packages(): array
    {
        return [
            $this->package([
                'name' => 'Starter Website Care',
                'slug' => 'starter-website-care',
                'short_description' => 'Reliable hosting for small businesses, startups, churches, personal brands and portfolio websites.',
                'annual_naira' => 25_000,
                'storage_gb' => 10,
                'websites' => 1,
                'databases' => 1,
                'backup_frequency' => 'weekly',
                'support_tier' => 'standard',
                'migration_included' => false,
                'is_popular' => false,
                'sort_order' => 1,
                'display_badge' => null,
                'cta_label' => 'Get Starter',
                'internal_notes' => null,
                'public_features' => [
                    'SSL certificate',
                    'Website hosting',
                    'Weekly backups',
                    'Basic technical support',
                    'DNS and domain assistance',
                    'Website recovery support',
                    'Renewal reminders',
                ],
                'internal_limits' => [
                    'backup_frequency' => 'weekly',
                    'support_level' => 'standard',
                    'website_health_check' => false,
                    'security_monitoring' => false,
                    'content_update_assistance' => false,
                    'priority_support' => false,
                ],
                'max_subdomains' => 5,
            ]),
            $this->package([
                'name' => 'Business Website Care',
                'slug' => 'business-website-care',
                'short_description' => 'Everything a growing business needs to stay online: regular backups, security monitoring, health checks and priority support.',
                'annual_naira' => 50_000,
                'storage_gb' => 25,
                'websites' => 1,
                'databases' => 3,
                'backup_frequency' => 'regular',
                'support_tier' => 'priority',
                'migration_included' => false,
                'is_popular' => true,
                'sort_order' => 2,
                'display_badge' => 'Most Popular',
                'cta_label' => 'Choose Business',
                'internal_notes' => 'Most Popular tier, highlighted in the pricing UI.',
                'public_features' => [
                    'SSL certificate',
                    'Regular backups',
                    'Security monitoring',
                    'Website health checks',
                    'Priority technical support',
                    'Minor website and content updates',
                    'Website recovery support',
                    'DNS assistance',
                ],
                'internal_limits' => [
                    'backup_frequency' => 'regular',
                    'support_level' => 'priority',
                    'website_health_check' => true,
                    'security_monitoring' => 'basic',
                    'content_update_assistance' => 'minor',
                    'priority_support' => true,
                ],
                'max_subdomains' => 15,
            ]),
            $this->package([
                'name' => 'Professional Website Care',
                'slug' => 'professional-website-care',
                'short_description' => 'For businesses running several websites that want daily backups, performance monitoring and migration help.',
                'annual_naira' => 100_000,
                'storage_gb' => 50,
                'websites' => 3,
                'databases' => 5,
                'backup_frequency' => 'daily',
                'support_tier' => 'priority',
                'migration_included' => true,
                'is_popular' => false,
                'sort_order' => 3,
                'display_badge' => null,
                'cta_label' => 'Get Professional',
                'internal_notes' => null,
                'public_features' => [
                    'SSL certificate',
                    'Daily backups',
                    'Security monitoring',
                    'Website health checks',
                    'Priority support',
                    'Minor content updates',
                    'Performance monitoring',
                    'Website migration assistance',
                ],
                'internal_limits' => [
                    'backup_frequency' => 'daily',
                    'support_level' => 'priority',
                    'website_health_check' => true,
                    'security_monitoring' => 'basic',
                    'content_update_assistance' => 'minor',
                    'priority_support' => true,
                    'performance_monitoring' => true,
                ],
                'max_subdomains' => 25,
            ]),
            $this->package([
                'name' => 'Premium Website Care',
                'slug' => 'premium-website-care',
                'short_description' => 'Full website care for established businesses: frequent backups, security reviews, monthly health checks and hands-on maintenance.',
                'annual_naira' => 180_000,
                'storage_gb' => 100,
                'websites' => 5,
                'databases' => 8,
                'backup_frequency' => 'frequent',
                'support_tier' => 'premium',
                'migration_included' => true,
                'is_popular' => false,
                'sort_order' => 4,
                'display_badge' => null,
                'cta_label' => 'Get Premium',
                'internal_notes' => null,
                'public_features' => [
                    'SSL certificate',
                    'Frequent backups',
                    'Security reviews',
                    'Performance monitoring',
                    'Monthly website health checks',
                    'Priority issue resolution',
                    'Content assistance',
                    'Website maintenance',
                    'Website migration assistance',
                ],
                'internal_limits' => [
                    'backup_frequency' => 'frequent',
                    'support_level' => 'premium',
                    'website_health_check' => 'monthly',
                    'security_monitoring' => 'enhanced',
                    'content_update_assistance' => 'extended',
                    'priority_support' => true,
                    'performance_monitoring' => true,
                ],
                'max_subdomains' => 40,
            ]),
        ];
    }

    /**
     * Expands a compact package definition into a full hosting_plans row.
     *
     * @param  array<string, mixed>  $p
     * @return array<string, mixed>
     */
    private function package(array $p): array
    {
        $annualKobo = $p['annual_naira'] * 100;
        $storageMb = $p['storage_gb'] * 1024;

        return [
            'name' => $p['name'],
            'slug' => $p['slug'],
            'short_description' => $p['short_description'],
            'monthly_price_kobo' => (int) round($annualKobo / 12),
            'annual_price_kobo' => $annualKobo,
            'setup_fee_kobo' => 0,
            'currency' => 'NGN',
            'storage_allocation' => $p['storage_gb'].'GB',
            'bandwidth_policy' => 'Unmetered bandwidth',
            'websites' => $p['websites'],
            'databases' => $p['databases'],
            'email_accounts' => HostingPlan::UNLIMITED_EMAIL_ACCOUNTS,
            'backup_frequency' => $p['backup_frequency'],
            'support_tier' => $p['support_tier'],
            'migration_included' => $p['migration_included'],
            'is_featured' => $p['is_popular'],
            'is_popular' => $p['is_popular'],
            'is_recommended' => $p['is_popular'],
            'is_active' => true,
            'is_public' => true,
            'is_orderable' => true,
            'status' => 'active',
            'sort_order' => $p['sort_order'],
            'display_badge' => $p['display_badge'],
            'cta_label' => $p['cta_label'],
            'internal_notes' => $p['internal_notes'],
            'public_features' => $p['public_features'],
            'internal_limits' => $p['internal_limits'] + [
                'business_emails' => 'unlimited',
                'ssh_access' => false,
                'sftp_access' => true,
            ],
            'configuration_json' => [
                'disk_quota_mb' => $storageMb,
                'bandwidth_quota_mb' => $storageMb * 10,
                'max_email_accounts' => HostingPlan::UNLIMITED_EMAIL_ACCOUNTS,
                'max_databases' => $p['databases'],
                'max_ftp_accounts' => 2,
                'ssh_access_enabled' => false,
                'sftp_access_enabled' => true,
                'ssl_enabled' => true,
                'backup_enabled' => true,
                'php_version' => '8.2',
                'max_subdomains' => $p['max_subdomains'],
                'max_aliases' => HostingPlan::UNLIMITED_EMAIL_ACCOUNTS,
                'default_server_id' => 1,
            ],
        ];
    }

    /**
     * Hidden internal package for clients/websites/services imported
     * read-only from an existing ISPConfig install. Never shown on the
     * public pricing page (is_public=false) and never orderable through the
     * normal checkout flow (is_orderable=false) — it exists purely so legacy
     * clients can be billed, tracked and eventually migrated to a Website
     * Care package after proper communication.
     *
     * @return array<string, mixed>
     */
    private function legacyPackage(): array
    {
        return [
            'name' => 'Legacy Hosting + SSL',
            'slug' => 'legacy-hosting-ssl',
            'plan_type' => 'legacy',
            'short_description' => 'Imported legacy ISPConfig hosting client. Hosting is ₦25,000/year and SSL is ₦15,000/year.',
            'monthly_price_kobo' => 0,
            'annual_price_kobo' => 4_000_000,
            'setup_fee_kobo' => 0,
            'hosting_amount_kobo' => 2_500_000,
            'ssl_amount_kobo' => 1_500_000,
            'currency' => 'NGN',
            'storage_allocation' => 'As provisioned in ISPConfig',
            'bandwidth_policy' => 'As provisioned in ISPConfig',
            'websites' => 0,
            'databases' => 0,
            'email_accounts' => 0,
            'backup_frequency' => null,
            'support_tier' => 'legacy',
            'migration_included' => false,
            'is_featured' => false,
            'is_popular' => false,
            'is_recommended' => false,
            'is_active' => true,
            'is_public' => false,
            'is_orderable' => false,
            'status' => 'active_internal',
            'sort_order' => 999,
            'display_badge' => null,
            'cta_label' => null,
            'internal_notes' => 'Hidden internal package for clients/services imported from ISPConfig via the Legacy ISPConfig Import feature. Do not make public or orderable.',
            'public_features' => [],
            'internal_limits' => [
                'hosting_amount' => 25000,
                'ssl_amount' => 15000,
                'renewal_amount' => 40000,
                'billing_cycle' => 'yearly',
            ],
            'configuration_json' => [
                'disk_quota_mb' => 0,
                'bandwidth_quota_mb' => 0,
                'max_email_accounts' => 50,
                'max_databases' => 10,
                'max_ftp_accounts' => 2,
                'ssh_access_enabled' => false,
                'sftp_access_enabled' => true,
                'ssl_enabled' => true,
                'backup_enabled' => false,
                'php_version' => '8.2',
                'max_subdomains' => 0,
                'max_aliases' => 0,
                'default_server_id' => 1,
            ],
        ];
    }
}
