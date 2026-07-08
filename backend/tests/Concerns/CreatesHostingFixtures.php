<?php

namespace Tests\Concerns;

use App\Models\Client;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Str;

trait CreatesHostingFixtures
{
    protected function createProvisionableHostingService(array $planConfiguration = [], array $serviceAttributes = []): HostingService
    {
        $user = User::factory()->create([
            'role' => 'client',
            'account_status' => 'active',
            'email_verified_at' => now(),
        ]);

        $client = Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CLT-'.Str::upper(Str::random(8)),
            'account_type' => 'billing_client',
            'client_status' => 'active',
            'status' => 'active',
            'billing_email' => $user->email,
            'country' => 'Nigeria',
        ]);

        $plan = HostingPlan::query()->create([
            'name' => 'Test Plan',
            'slug' => 'test-plan-'.Str::random(6),
            'short_description' => 'Test plan',
            'monthly_price_kobo' => 250000,
            'annual_price_kobo' => 2500000,
            'storage_allocation' => '10GB SSD',
            'bandwidth_policy' => 'Unmetered',
            'websites' => 1,
            'databases' => 2,
            'email_accounts' => 3,
            'is_active' => true,
            'configuration_json' => array_merge([
                'disk_quota_mb' => 10240,
                'bandwidth_quota_mb' => 102400,
                'max_email_accounts' => 3,
                'max_databases' => 2,
                'max_ftp_accounts' => 2,
                'ssh_access_enabled' => false,
                'sftp_access_enabled' => true,
                'ssl_enabled' => true,
                'backup_enabled' => true,
                'php_version' => '8.2',
                'max_subdomains' => 5,
                'max_aliases' => 3,
                'default_server_id' => 1,
            ], $planConfiguration),
        ]);

        $order = Order::query()->create([
            'client_id' => $client->id,
            'order_number' => 'ORD-'.Str::upper(Str::random(8)),
            'status' => 'completed',
            'subtotal_kobo' => 2500000,
            'total_kobo' => 2500000,
        ]);

        Invoice::query()->create([
            'client_id' => $client->id,
            'order_id' => $order->id,
            'invoice_number' => 'INV-'.Str::upper(Str::random(8)),
            'status' => 'paid',
            'subtotal_kobo' => 2500000,
            'total_kobo' => 2500000,
            'amount_paid_kobo' => 2500000,
            'issued_at' => now()->toDateString(),
            'due_at' => now()->addDays(7)->toDateString(),
            'paid_at' => now()->toDateString(),
        ]);

        return HostingService::query()->create(array_merge([
            'client_id' => $client->id,
            'hosting_plan_id' => $plan->id,
            'order_id' => $order->id,
            'service_number' => 'SRV-'.Str::upper(Str::random(8)),
            'primary_domain' => 'example-'.Str::random(6).'.test',
            'status' => 'awaiting_provisioning',
            'provisioning_status' => 'awaiting_provisioning',
        ], $serviceAttributes));
    }
}
