<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\HostingAddOn;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\IspConfigClientMapping;
use App\Models\IspConfigServiceMapping;
use App\Models\NotificationLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProvisioningLog;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->updateOrCreate(
            ['email' => 'admin@naitalk.com'],
            [
                'name' => 'Caleb Adeleye',
                'phone' => '07087057654',
                'role' => 'super_admin',
                'account_status' => 'active',
                'email_verified_at' => now(),
                'password' => 'password',
            ]
        );

        $clientUser = User::query()->updateOrCreate(
            ['email' => 'john@naitalk.test'],
            [
                'name' => 'John Adewale',
                'phone' => '08000000001',
                'role' => 'client',
                'account_status' => 'active',
                'email_verified_at' => now(),
                'password' => 'password',
            ]
        );

        $client = Client::query()->updateOrCreate(
            ['user_id' => $clientUser->id],
            [
                'client_code' => 'CLT-202607-JOHN',
                'company_name' => 'ScholarJoint',
                'account_type' => 'hosting_client',
                'client_status' => 'active',
                'status' => 'active',
                'billing_email' => $clientUser->email,
                'billing_phone' => $clientUser->phone,
                'city' => 'Lagos',
                'country' => 'Nigeria',
            ]
        );

        $prospectUser = User::query()->updateOrCreate(
            ['email' => 'prospect@naitalk.test'],
            [
                'name' => 'Tola Registered',
                'phone' => '08000000005',
                'role' => 'client',
                'account_status' => 'pending_verification',
                'password' => 'password',
            ]
        );

        Client::query()->updateOrCreate(
            ['user_id' => $prospectUser->id],
            [
                'client_code' => 'CLT-202607-PROSPECT',
                'company_name' => null,
                'account_type' => 'registered_user',
                'client_status' => 'active',
                'status' => 'active',
                'billing_email' => $prospectUser->email,
                'billing_phone' => $prospectUser->phone,
                'city' => 'Lagos',
                'country' => 'Nigeria',
            ]
        );

        $plans = collect([
            ['Starter', 'starter', 'Perfect for small websites', 1500000, 15000000, '10GB SSD', 'Unmetered bandwidth', 1, 1, 1, 'Weekly', 'standard', false, false, 1, 10240, false, false],
            ['Business', 'business', 'Great for growing businesses', 2500000, 25000000, '20GB SSD', 'Unmetered bandwidth', 10, 10, 10, 'Daily', 'priority', true, true, 2, 20480, false, true],
            ['Professional', 'professional', 'Advanced for professionals', 4500000, 45000000, '40GB SSD', 'Unmetered bandwidth', 50, 50, 50, 'Daily', 'priority', true, false, 3, 40960, false, true],
            ['Managed', 'managed', 'For high performance needs', 8500000, 85000000, '80GB SSD', 'Unmetered bandwidth', 100, 100, 100, 'Daily', 'managed', true, false, 4, 81920, true, true],
        ])->mapWithKeys(function (array $plan) {
            [$name, $slug, $shortDescription, $monthly, $annual, $storage, $bandwidthPolicy, $websites, $databases, $emailAccounts, $backupFrequency, $supportTier, $migrationIncluded, $isFeatured, $sortOrder, $diskQuotaMb, $sshEnabled, $sftpEnabled] = $plan;

            return [
                $slug => HostingPlan::query()->updateOrCreate(
                    ['slug' => $slug],
                    [
                        'name' => $name,
                        'short_description' => $shortDescription,
                        'monthly_price_kobo' => $monthly,
                        'annual_price_kobo' => $annual,
                        'setup_fee_kobo' => 0,
                        'storage_allocation' => $storage,
                        'bandwidth_policy' => $bandwidthPolicy,
                        'websites' => $websites,
                        'databases' => $databases,
                        'email_accounts' => $emailAccounts,
                        'backup_frequency' => $backupFrequency,
                        'support_tier' => $supportTier,
                        'migration_included' => $migrationIncluded,
                        'is_featured' => $isFeatured,
                        'is_active' => true,
                        'sort_order' => $sortOrder,
                        'configuration_json' => [
                            'disk_quota_mb' => $diskQuotaMb,
                            'bandwidth_quota_mb' => $diskQuotaMb * 10,
                            'max_email_accounts' => $emailAccounts,
                            'max_databases' => $databases,
                            'max_ftp_accounts' => $websites,
                            'ssh_access_enabled' => $sshEnabled,
                            'sftp_access_enabled' => $sftpEnabled,
                            'ssl_enabled' => true,
                            'backup_enabled' => true,
                            'php_version' => '8.2',
                            'max_subdomains' => $websites * 5,
                            'max_aliases' => $emailAccounts,
                            'default_server_id' => 1,
                        ],
                    ]
                ),
            ];
        });

        foreach ([
            ['Professional Email', 'professional-email', 'Managed mailbox setup and support.', 500000, 1000000],
            ['Website Backup', 'website-backup', 'Managed offsite backups.', 500000, 1500000],
            ['Website Migration', 'website-migration', 'Move an existing website safely.', 0, 2500000],
            ['Priority Support', 'priority-support', 'Faster support response windows.', 1000000, 10000000],
        ] as [$name, $slug, $description, $monthly, $annual]) {
            HostingAddOn::query()->updateOrCreate(
                ['slug' => $slug],
                compact('name', 'description') + [
                    'monthly_price_kobo' => $monthly,
                    'annual_price_kobo' => $annual,
                    'is_active' => true,
                ]
            );
        }

        $order = Order::query()->updateOrCreate(
            ['order_number' => 'ORD-2026-0162'],
            [
                'client_id' => $client->id,
                'status' => 'completed',
                'billing_cycle' => 'annual',
                'subtotal_kobo' => 2500000,
                'discount_kobo' => 0,
                'tax_kobo' => 0,
                'total_kobo' => 2500000,
                'accepted_terms_at' => now()->subDays(10),
                'metadata' => ['auto_renew' => true],
            ]
        );

        $invoice = Invoice::query()->updateOrCreate(
            ['invoice_number' => 'INV-2026-0321'],
            [
                'client_id' => $client->id,
                'order_id' => $order->id,
                'status' => 'unpaid',
                'subtotal_kobo' => 2500000,
                'discount_kobo' => 0,
                'tax_kobo' => 0,
                'total_kobo' => 2500000,
                'amount_paid_kobo' => 0,
                'issued_at' => now()->subDays(3)->toDateString(),
                'due_at' => now()->addDays(7)->toDateString(),
                'line_items' => [['description' => 'Business Hosting - Annual', 'quantity' => 1, 'total_kobo' => 2500000]],
            ]
        );

        foreach ([2500000, 4800000, 2300000, 1500000] as $index => $amount) {
            Payment::query()->updateOrCreate(
                ['reference' => 'PAY-SEED-'.$index],
                [
                    'client_id' => $client->id,
                    'invoice_id' => $invoice->id,
                    'gateway' => $index % 2 === 0 ? 'paystack' : 'flutterwave',
                    'status' => 'paid',
                    'amount_kobo' => $amount,
                    'paid_at' => now()->subDays($index + 1),
                    'gateway_payload' => ['seeded' => true],
                ]
            );
        }

        foreach ([
            ['SRV-2026-001', 'scholarjoint.com', 'Business Hosting'],
            ['SRV-2026-002', 'scholarjoint.com Email', 'Professional Email'],
            ['SRV-2026-003', 'SSL Certificate', 'PositiveSSL'],
        ] as [$number, $domain, $label]) {
            $service = HostingService::query()->updateOrCreate(
                ['service_number' => $number],
                [
                    'client_id' => $client->id,
                    'hosting_plan_id' => $plans['business']->id,
                    'order_id' => $order->id,
                    'primary_domain' => $domain,
                    'status' => 'active',
                    'billing_cycle' => 'annual',
                    'amount_kobo' => 2500000,
                    'starts_at' => now()->subMonths(2)->toDateString(),
                    'next_due_date' => now()->addDays(12)->toDateString(),
                    'renews_at' => now()->addDays(12)->toDateString(),
                    'auto_renew_enabled' => true,
                    'provisioning_status' => 'provisioned',
                    'ispconfig_server_id' => 1,
                    'ispconfig_site_id' => 'ISP-'.$number,
                    'provisioning_payload' => ['label' => $label],
                ]
            );

            $clientMapping = IspConfigClientMapping::query()->updateOrCreate(
                ['client_id' => $client->id, 'ispconfig_server_id' => 1],
                [
                    'ispconfig_client_id' => 'CLIENT-1-'.str_pad((string) $client->id, 6, '0', STR_PAD_LEFT),
                    'sync_status' => 'provisioned',
                    'provisioned_at' => now()->subDays(60),
                    'last_synced_at' => now()->subHours(2),
                    'metadata_json' => ['seeded' => true],
                ]
            );

            IspConfigServiceMapping::query()->updateOrCreate(
                ['hosting_service_id' => $service->id, 'ispconfig_server_id' => 1],
                [
                    'ispconfig_client_mapping_id' => $clientMapping->id,
                    'ispconfig_website_id' => 'WEB-1-'.str_pad((string) $service->id, 6, '0', STR_PAD_LEFT),
                    'ispconfig_mail_domain_id' => 'MAIL-1-'.str_pad((string) $service->id, 6, '0', STR_PAD_LEFT),
                    'ispconfig_database_id' => 'DB-1-'.str_pad((string) $service->id, 6, '0', STR_PAD_LEFT),
                    'ispconfig_ftp_user_id' => 'FTP-1-'.str_pad((string) $service->id, 6, '0', STR_PAD_LEFT),
                    'technical_status' => 'active',
                    'last_synced_at' => now()->subHours(2),
                    'metadata_json' => ['seeded' => true],
                ]
            );

            ProvisioningLog::query()->updateOrCreate(
                ['hosting_service_id' => $service->id, 'action' => 'create_hosting_service'],
                [
                    'client_id' => $client->id,
                    'order_id' => $order->id,
                    'provider' => 'ispconfig',
                    'status' => 'completed',
                    'message' => 'Seeded provisioning completed.',
                    'started_at' => now()->subDays(60),
                    'finished_at' => now()->subDays(60)->addMinutes(4),
                ]
            );
        }

        SupportTicket::query()->updateOrCreate(
            ['ticket_number' => 'TCK-2026-0001'],
            [
                'client_id' => $client->id,
                'subject' => 'Email setup support',
                'status' => 'open',
                'priority' => 'normal',
                'latest_message' => 'Please help confirm the correct mail client settings.',
            ]
        );

        NotificationLog::query()->updateOrCreate(
            ['recipient' => $clientUser->email, 'template' => 'invoice_created'],
            [
                'client_id' => $client->id,
                'channel' => 'mail',
                'status' => 'sent',
                'payload' => ['invoice_number' => $invoice->invoice_number],
                'sent_at' => now()->subDays(3),
            ]
        );

        $this->call(ServiceOfferingSeeder::class);

        $admin->tokens()->delete();
        $clientUser->tokens()->delete();
    }
}
