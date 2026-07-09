<?php

namespace Tests\Feature;

use App\Models\HostingPlan;
use App\Models\HostingService;
use Database\Seeders\HostingPlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebsiteCarePackagesTest extends TestCase
{
    use RefreshDatabase;

    private function adminToken(): string
    {
        $this->seed();

        return $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    public function test_seeder_creates_the_three_website_care_packages_in_order(): void
    {
        (new HostingPlanSeeder())->run();

        // Three public Website Care packages + one hidden internal
        // "Legacy Hosting + SSL" package for imported ISPConfig clients.
        $this->assertDatabaseCount('hosting_plans', 4);

        $slugs = HostingPlan::query()->orderBy('sort_order')->pluck('slug')->all();
        $this->assertSame(['starter-website-care', 'business-website-care', 'premium-website-care', 'legacy-hosting-ssl'], $slugs);
    }

    public function test_running_the_seeder_twice_does_not_duplicate_packages(): void
    {
        (new HostingPlanSeeder())->run();
        (new HostingPlanSeeder())->run();

        $this->assertDatabaseCount('hosting_plans', 4);
    }

    public function test_business_website_care_is_marked_popular_and_recommended(): void
    {
        (new HostingPlanSeeder())->run();

        $business = HostingPlan::query()->where('slug', 'business-website-care')->firstOrFail();

        $this->assertTrue($business->is_popular);
        $this->assertTrue($business->is_recommended);
        $this->assertSame('Most Popular', $business->display_badge);
        $this->assertSame(2, $business->sort_order);
        $this->assertSame('active', $business->status);
        $this->assertTrue($business->is_active);
    }

    public function test_seeder_deactivates_legacy_plan_slugs_instead_of_deleting_them(): void
    {
        HostingPlan::query()->create([
            'name' => 'Business',
            'slug' => 'business',
            'short_description' => 'Legacy plan',
            'monthly_price_kobo' => 2500000,
            'annual_price_kobo' => 25000000,
            'storage_allocation' => '20GB SSD',
            'bandwidth_policy' => 'Unmetered bandwidth',
            'websites' => 10,
            'databases' => 10,
            'email_accounts' => 10,
            'is_active' => true,
        ]);

        (new HostingPlanSeeder())->run();
        (new HostingPlanSeeder())->run();

        $this->assertDatabaseHas('hosting_plans', [
            'slug' => 'business',
            'is_active' => false,
            'status' => 'deprecated',
        ]);
        $this->assertDatabaseHas('hosting_plans', [
            'slug' => 'business-website-care',
            'is_active' => true,
        ]);
        // Deactivating the legacy plan must never delete it — hosting_services
        // still points at it via a restrictOnDelete() foreign key. 3 Website
        // Care + 1 hidden Legacy Hosting + SSL + the pre-existing "business" row.
        $this->assertDatabaseCount('hosting_plans', 5);
    }

    public function test_public_pricing_page_hides_technical_fields(): void
    {
        (new HostingPlanSeeder())->run();

        $response = $this->getJson('/api/v1/public/hosting-plans')->assertOk();

        foreach ($response->json() as $plan) {
            foreach (['ssh_access', 'sftp_access', 'bandwidth_policy', 'storage_allocation', 'php_version', 'websites', 'databases', 'internal_limits', 'configuration_json'] as $technicalKey) {
                $this->assertArrayNotHasKey($technicalKey, $plan, "Public pricing payload should not expose \"{$technicalKey}\".");
            }

            $featuresText = implode(' ', $plan['public_features']);
            foreach (['SSH', 'SFTP', 'FTP', 'cron', 'PHP version', 'MySQL', 'bandwidth', 'GB SSD'] as $technicalTerm) {
                $this->assertStringNotContainsStringIgnoringCase($technicalTerm, $featuresText, "Public feature list should not mention \"{$technicalTerm}\".");
            }
        }
    }

    public function test_public_pricing_page_shows_customer_friendly_benefits_and_badge(): void
    {
        (new HostingPlanSeeder())->run();

        $response = $this->getJson('/api/v1/public/hosting-plans')->assertOk();
        $business = collect($response->json())->firstWhere('slug', 'business-website-care');

        $this->assertNotNull($business);
        $this->assertSame('Most Popular', $business['display_badge']);
        $this->assertTrue($business['is_popular']);
        $this->assertTrue($business['is_recommended']);
        $this->assertSame('Choose Business Care', $business['cta_label']);
        $this->assertContains('Priority support', $business['public_features']);
        $this->assertContains('Peace of mind support', $business['public_features']);
    }

    public function test_monthly_and_yearly_prices_display_correctly(): void
    {
        (new HostingPlanSeeder())->run();

        $response = $this->getJson('/api/v1/public/hosting-plans')->assertOk();
        $plans = collect($response->json())->keyBy('slug');

        $this->assertSame('₦5,000', $plans['starter-website-care']['monthly_price']);
        $this->assertSame('₦50,000', $plans['starter-website-care']['annual_price']);
        $this->assertSame('₦10,000', $plans['business-website-care']['monthly_price']);
        $this->assertSame('₦100,000', $plans['business-website-care']['annual_price']);
        $this->assertSame('₦18,000', $plans['premium-website-care']['monthly_price']);
        $this->assertSame('₦180,000', $plans['premium-website-care']['annual_price']);
    }

    public function test_internal_limits_are_preserved_for_provisioning_but_not_public(): void
    {
        (new HostingPlanSeeder())->run();

        $business = HostingPlan::query()->where('slug', 'business-website-care')->firstOrFail();

        $this->assertSame(15, $business->internal_limits['business_emails']);
        $this->assertTrue($business->internal_limits['priority_support']);
        $this->assertFalse($business->internal_limits['ssh_access']);
        $this->assertTrue($business->internal_limits['sftp_access']);

        $response = $this->getJson('/api/v1/public/hosting-plans')->assertOk();
        $businessPayload = collect($response->json())->firstWhere('slug', 'business-website-care');
        $this->assertArrayNotHasKey('internal_limits', $businessPayload);
    }

    /**
     * FTP is needed on every package to upload files to the website
     * directory in ISPConfig, but capped at 2 accounts regardless of tier —
     * unlike SSH, which stays off everywhere (a separate jailkit feature).
     */
    public function test_ftp_is_available_on_every_hosting_plan_capped_at_two_accounts(): void
    {
        (new HostingPlanSeeder())->run();

        foreach (['starter-website-care', 'business-website-care', 'premium-website-care', 'legacy-hosting-ssl'] as $slug) {
            $plan = HostingPlan::query()->where('slug', $slug)->firstOrFail();
            $configuration = $plan->configuration();

            $this->assertTrue($configuration['sftp_access_enabled'], "{$slug} should have FTP/SFTP enabled.");
            $this->assertFalse($configuration['ssh_access_enabled'], "{$slug} should not grant SSH shell access.");
            $this->assertSame(2, $configuration['max_ftp_accounts'], "{$slug} should cap FTP accounts at 2.");
        }
    }

    public function test_admin_can_list_and_see_full_package_details_including_internal_limits(): void
    {
        $token = $this->adminToken();

        $response = $this->withToken($token)->getJson('/api/v1/admin/pricing-packages')->assertOk();
        $business = collect($response->json('data'))->firstWhere('slug', 'business-website-care');

        $this->assertNotNull($business);
        $this->assertSame('Most Popular', $business['display_badge']);
        $this->assertTrue($business['is_popular']);
        $this->assertTrue($business['is_recommended']);
        $this->assertSame(15, $business['internal_limits']['business_emails']);
        $this->assertSame('₦10,000', $business['monthly_price']);
    }

    public function test_admin_can_update_a_package_including_badge_and_public_features(): void
    {
        $token = $this->adminToken();
        $premium = HostingPlan::query()->where('slug', 'premium-website-care')->firstOrFail();

        $this->withToken($token)->putJson("/api/v1/admin/pricing-packages/{$premium->id}", [
            'name' => $premium->name,
            'slug' => $premium->slug,
            'short_description' => $premium->short_description,
            'monthly_price_kobo' => $premium->monthly_price_kobo,
            'annual_price_kobo' => $premium->annual_price_kobo,
            'storage_allocation' => $premium->storage_allocation,
            'bandwidth_policy' => $premium->bandwidth_policy,
            'websites' => $premium->websites,
            'databases' => $premium->databases,
            'email_accounts' => $premium->email_accounts,
            'support_tier' => $premium->support_tier,
            'sort_order' => $premium->sort_order,
            'is_recommended' => true,
            'display_badge' => 'Best for Full Care',
            'public_features' => ['Everything in Business', 'White-glove onboarding call'],
        ])->assertOk()
            ->assertJsonPath('display_badge', 'Best for Full Care')
            ->assertJsonPath('is_recommended', true)
            ->assertJsonPath('public_features', ['Everything in Business', 'White-glove onboarding call']);

        $this->assertDatabaseHas('hosting_plans', ['slug' => 'premium-website-care', 'display_badge' => 'Best for Full Care']);
    }

    public function test_admin_disabling_a_package_deactivates_it_without_deleting_or_orphaning_subscriptions(): void
    {
        $token = $this->adminToken();
        $starter = HostingPlan::query()->where('slug', 'starter-website-care')->firstOrFail();

        HostingService::query()->create([
            'client_id' => \App\Models\Client::query()->firstOrFail()->id,
            'hosting_plan_id' => $starter->id,
            'service_number' => 'SRV-TEST-0001',
            'primary_domain' => 'starter-care-test.example',
            'status' => 'active',
        ]);

        $this->withToken($token)->deleteJson("/api/v1/admin/pricing-packages/{$starter->id}")
            ->assertOk()
            ->assertJsonPath('is_active', false);

        // The package row must still exist — hosting_services.hosting_plan_id
        // has a restrictOnDelete() foreign key, so a real delete would fail
        // anyway, but the endpoint must never attempt one.
        $this->assertDatabaseHas('hosting_plans', ['id' => $starter->id]);
        $this->assertDatabaseHas('hosting_services', ['hosting_plan_id' => $starter->id]);
    }
}
