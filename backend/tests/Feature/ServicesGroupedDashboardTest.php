<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\TestCase;

class ServicesGroupedDashboardTest extends TestCase
{
    use CreatesHostingFixtures, RefreshDatabase;

    /**
     * Deliberately avoids the full DatabaseSeeder (which seeds demo hosting
     * services) so metric assertions aren't polluted by unrelated baseline
     * data — only a bare admin user is needed to authenticate.
     */
    private function adminToken(): string
    {
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'account_status' => 'active',
            'email_verified_at' => now(),
            'password' => 'password',
        ]);

        return $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    public function test_active_services_are_grouped_by_service_type(): void
    {
        $token = $this->adminToken();

        $response = $this->withToken($token)->getJson('/api/v1/admin/services/grouped')->assertOk();

        $groups = collect($response->json('data'))->pluck('service_type');

        foreach (['hosting', 'ssl', 'domain', 'email', 'website_maintenance', 'support', 'website_development', 'custom_services', 'legacy_hosting_ssl'] as $expected) {
            $this->assertContains($expected, $groups, "Expected the {$expected} group to always be present.");
        }
    }

    public function test_service_group_metrics_are_calculated_correctly(): void
    {
        $token = $this->adminToken();

        $active = $this->createProvisionableHostingService([], [
            'status' => 'active',
            'service_type' => 'hosting',
            'amount_kobo' => 2_500_000,
            'renews_at' => now()->addDays(5)->toDateString(),
        ]);
        $suspended = $this->createProvisionableHostingService([], [
            'status' => 'suspended',
            'service_type' => 'hosting',
            'amount_kobo' => 2_500_000,
        ]);
        $expired = $this->createProvisionableHostingService([], [
            'status' => 'expired',
            'service_type' => 'hosting',
        ]);

        Invoice::query()->create([
            'client_id' => $active->client_id,
            'hosting_service_id' => $active->id,
            'invoice_number' => 'INV-GROUP-TEST-1',
            'status' => 'paid',
            'subtotal_kobo' => 2_500_000,
            'total_kobo' => 2_500_000,
            'amount_paid_kobo' => 2_500_000,
            'issued_at' => now()->toDateString(),
            'due_at' => now()->addDays(7)->toDateString(),
        ]);

        $response = $this->withToken($token)->getJson('/api/v1/admin/services/grouped')->assertOk();
        $hosting = collect($response->json('data'))->firstWhere('service_type', 'hosting');

        $this->assertSame(1, $hosting['active_count']);
        $this->assertSame(1, $hosting['suspended_count']);
        $this->assertSame(1, $hosting['expired_count']);
        $this->assertSame(3, $hosting['client_count']);
        $this->assertSame(1, $hosting['due_soon_count']);
        // active + suspended amount_kobo (expired is excluded from expected renewal revenue).
        $this->assertSame(5_000_000, $hosting['expected_renewal_revenue_kobo']);
        $this->assertSame(2_500_000, $hosting['revenue_generated_kobo']);
    }
}
