<?php

namespace Database\Seeders;

use App\Models\HostingPlan;
use Illuminate\Database\Seeder;

/**
 * Seeds the three "Website Care" packages shown on the public pricing page,
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
     * @return array<int, array<string, mixed>>
     */
    private function packages(): array
    {
        return [
            [
                'name' => 'Starter Website Care',
                'slug' => 'starter-website-care',
                'short_description' => 'Basic website care for small businesses, personal brands, churches, schools, landing pages, and simple company websites.',
                'monthly_price_kobo' => 500_000,
                'annual_price_kobo' => 5_000_000,
                'setup_fee_kobo' => 0,
                'currency' => 'NGN',
                'storage_allocation' => '5GB SSD',
                'bandwidth_policy' => 'Unmetered bandwidth',
                'websites' => 1,
                'databases' => 1,
                'email_accounts' => 2,
                'backup_frequency' => 'weekly',
                'support_tier' => 'standard',
                'migration_included' => false,
                'is_featured' => false,
                'is_popular' => false,
                'is_recommended' => false,
                'is_active' => true,
                'status' => 'active',
                'sort_order' => 1,
                'display_badge' => null,
                'cta_label' => 'Start Basic',
                'internal_notes' => null,
                'public_features' => [
                    'Website hosting',
                    'Website security lock / SSL',
                    '1 professional business email',
                    'Weekly website backup',
                    'Basic website support',
                    'Renewal reminders',
                    'Website recovery support',
                    'Peace of mind',
                ],
                'internal_limits' => [
                    'business_emails' => 2,
                    'backup_frequency' => 'weekly',
                    'support_level' => 'standard',
                    'website_health_check' => false,
                    'security_monitoring' => false,
                    'content_update_assistance' => false,
                    'priority_support' => false,
                    'ssh_access' => false,
                    'sftp_access' => true,
                ],
                'configuration_json' => [
                    'disk_quota_mb' => 5120,
                    'bandwidth_quota_mb' => 51200,
                    'max_email_accounts' => 2,
                    'max_databases' => 1,
                    'max_ftp_accounts' => 2,
                    'ssh_access_enabled' => false,
                    'sftp_access_enabled' => true,
                    'ssl_enabled' => true,
                    'backup_enabled' => true,
                    'php_version' => '8.2',
                    'max_subdomains' => 5,
                    'max_aliases' => 2,
                    'default_server_id' => 1,
                ],
            ],
            [
                'name' => 'Business Website Care',
                'slug' => 'business-website-care',
                'short_description' => 'Recommended for growing businesses that need reliable website care, business email, backup protection, faster support, and peace of mind.',
                'monthly_price_kobo' => 1_000_000,
                'annual_price_kobo' => 10_000_000,
                'setup_fee_kobo' => 0,
                'currency' => 'NGN',
                'storage_allocation' => '15GB SSD',
                'bandwidth_policy' => 'Unmetered bandwidth',
                'websites' => 3,
                'databases' => 3,
                'email_accounts' => 15,
                'backup_frequency' => 'regular',
                'support_tier' => 'priority',
                'migration_included' => true,
                'is_featured' => true,
                'is_popular' => true,
                'is_recommended' => true,
                'is_active' => true,
                'status' => 'active',
                'sort_order' => 2,
                'display_badge' => 'Most Popular',
                'cta_label' => 'Choose Business Care',
                'internal_notes' => 'Best Value for Growing Businesses — recommended tier, highlighted in the pricing UI.',
                'public_features' => [
                    'Everything in Starter',
                    'Up to 5 professional business emails',
                    'Priority support',
                    'Regular website health checks',
                    'Stronger backup protection',
                    'Basic security monitoring',
                    'Faster issue resolution',
                    'Minor content update assistance',
                    'Peace of mind support',
                ],
                'internal_limits' => [
                    'business_emails' => 15,
                    'backup_frequency' => 'regular',
                    'support_level' => 'priority',
                    'website_health_check' => true,
                    'security_monitoring' => 'basic',
                    'content_update_assistance' => 'minor',
                    'priority_support' => true,
                    'ssh_access' => false,
                    'sftp_access' => true,
                ],
                'configuration_json' => [
                    'disk_quota_mb' => 15360,
                    'bandwidth_quota_mb' => 153600,
                    'max_email_accounts' => 15,
                    'max_databases' => 3,
                    'max_ftp_accounts' => 2,
                    'ssh_access_enabled' => false,
                    'sftp_access_enabled' => true,
                    'ssl_enabled' => true,
                    'backup_enabled' => true,
                    'php_version' => '8.2',
                    'max_subdomains' => 15,
                    'max_aliases' => 15,
                    'default_server_id' => 1,
                ],
            ],
            [
                'name' => 'Premium Website Care',
                'slug' => 'premium-website-care',
                'short_description' => 'Full website care for businesses that want priority support, frequent backups, security review, performance review, and more managed assistance.',
                'monthly_price_kobo' => 1_800_000,
                'annual_price_kobo' => 18_000_000,
                'setup_fee_kobo' => 0,
                'currency' => 'NGN',
                'storage_allocation' => '40GB SSD',
                'bandwidth_policy' => 'Unmetered bandwidth',
                'websites' => 5,
                'databases' => 5,
                'email_accounts' => 10,
                'backup_frequency' => 'frequent',
                'support_tier' => 'premium',
                'migration_included' => true,
                'is_featured' => false,
                'is_popular' => false,
                'is_recommended' => false,
                'is_active' => true,
                'status' => 'active',
                'sort_order' => 3,
                'display_badge' => null,
                'cta_label' => 'Get Premium Care',
                'internal_notes' => null,
                'public_features' => [
                    'Everything in Business',
                    'Up to 30 professional business emails',
                    'Frequent website backups',
                    'Monthly website checkup',
                    'Priority issue resolution',
                    'Security review',
                    'Performance review',
                    'More content update assistance',
                    'Maximum peace of mind',
                ],
                'internal_limits' => [
                    'business_emails' => 10,
                    'backup_frequency' => 'frequent',
                    'support_level' => 'premium',
                    'website_health_check' => 'monthly',
                    'security_monitoring' => 'enhanced',
                    'content_update_assistance' => 'extended',
                    'priority_support' => true,
                    'ssh_access' => false,
                    'sftp_access' => true,
                ],
                'configuration_json' => [
                    'disk_quota_mb' => 40960,
                    'bandwidth_quota_mb' => 409600,
                    'max_email_accounts' => 10,
                    'max_databases' => 5,
                    'max_ftp_accounts' => 2,
                    'ssh_access_enabled' => false,
                    'sftp_access_enabled' => true,
                    'ssl_enabled' => true,
                    'backup_enabled' => true,
                    'php_version' => '8.2',
                    'max_subdomains' => 25,
                    'max_aliases' => 10,
                    'default_server_id' => 1,
                ],
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
