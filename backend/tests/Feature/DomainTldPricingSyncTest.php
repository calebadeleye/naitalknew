<?php

namespace Tests\Feature;

use App\Models\DomainPricing;
use App\Models\DomainPricingSettings;
use App\Models\DomainPricingSyncLog;
use App\Models\DomainSyncLog;
use App\Services\Domains\DomainPricingService;
use App\Services\Domains\SpaceshipTldPricingSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\TestCase;

/**
 * Covers the Spaceship TLD price sync, FX conversion, and markup system.
 * SpaceshipClient::listTldPricing() always uses its dry-run fake list in
 * the testing environment (forceLive is blocked there regardless of
 * sandbox_mode — see SpaceshipClient::request()), so these tests exercise
 * the same deterministic 6-TLD payload every run without any network I/O.
 */
class DomainTldPricingSyncTest extends TestCase
{
    use CreatesDomainFixtures, RefreshDatabase;

    private function configureFxSettings(array $overrides = []): DomainPricingSettings
    {
        $settings = DomainPricingSettings::forProvider('spaceship');
        $settings->update(array_merge([
            'exchange_rate' => 1600,
            'safety_buffer_percent' => 0,
            'default_markup_type' => 'cost_plus_markup',
            'default_markup_value_kobo' => 700_000,
        ], $overrides));

        return $settings->fresh();
    }

    public function test_sync_creates_new_tld_records_using_the_global_default_markup(): void
    {
        $this->configureFxSettings();

        $log = app(SpaceshipTldPricingSyncService::class)->sync('manual');

        $this->assertSame('success', $log->status);
        $this->assertSame(6, $log->total_tlds_found);
        $this->assertSame(6, $log->total_tlds_created);
        $this->assertSame(0, $log->total_tlds_updated);
        $this->assertSame(0, $log->total_tlds_failed);

        $com = DomainPricing::where('provider', 'spaceship')->where('tld', '.com')->firstOrFail();
        $this->assertSame('cost_plus_markup', $com->markup_type);
        $this->assertSame(700_000, $com->markup_value_kobo);
        // New TLDs are never auto-published — admin must review first.
        $this->assertSame('needs_review', $com->status);
        // Dry-run fixture: $12.98 (1298 cents) x ₦1,600 = ₦20,768 = 2,076,800 kobo.
        $this->assertSame(2_076_800, $com->registration_price_kobo);
        $this->assertSame('USD', $com->provider_currency);
        $this->assertSame(1298, $com->provider_registration_price_minor);
    }

    public function test_rerunning_sync_updates_existing_records_without_duplicating(): void
    {
        $this->configureFxSettings();
        app(SpaceshipTldPricingSyncService::class)->sync('manual');
        $this->assertSame(6, DomainPricing::where('provider', 'spaceship')->count());

        $log = app(SpaceshipTldPricingSyncService::class)->sync('manual');

        $this->assertSame(0, $log->total_tlds_created);
        $this->assertSame(6, $log->total_tlds_updated);
        $this->assertSame(6, DomainPricing::where('provider', 'spaceship')->count());
    }

    public function test_provider_cost_changes_never_overwrite_an_existing_admin_markup(): void
    {
        $this->configureFxSettings();
        app(SpaceshipTldPricingSyncService::class)->sync('manual');

        $com = DomainPricing::where('tld', '.com')->firstOrFail();
        $com->update(['markup_type' => 'percentage_markup', 'markup_percent' => 25, 'status' => 'active']);

        // The FX rate changes — the cost basis must update, but the admin's markup must not.
        $this->configureFxSettings(['exchange_rate' => 1700]);
        app(SpaceshipTldPricingSyncService::class)->sync('manual');

        $com->refresh();
        $this->assertSame('percentage_markup', $com->markup_type);
        $this->assertEquals(25.0, (float) $com->markup_percent);
        $this->assertSame('active', $com->status);
        // 1298 x 1700 = 2,206,600.
        $this->assertSame(2_206_600, $com->registration_price_kobo);
    }

    public function test_safety_buffer_percent_is_applied_to_the_converted_cost(): void
    {
        $this->configureFxSettings(['safety_buffer_percent' => 5]);
        app(SpaceshipTldPricingSyncService::class)->sync('manual');

        $com = DomainPricing::where('tld', '.com')->firstOrFail();
        // 1298 x 1600 x 1.05 = 2,180,640.
        $this->assertSame(2_180_640, $com->registration_price_kobo);
    }

    public function test_fixed_amount_markup_calculates_the_correct_customer_price(): void
    {
        $pricing = new DomainPricing(['markup_type' => 'cost_plus_markup', 'markup_value_kobo' => 700_000]);

        $this->assertSame(2_776_800, app(DomainPricingService::class)->customerPrice($pricing, 2_076_800));
    }

    public function test_percentage_markup_calculates_the_correct_customer_price(): void
    {
        $pricing = new DomainPricing(['markup_type' => 'percentage_markup', 'markup_percent' => 30]);

        // ₦16,000 x 1.30 = ₦20,800.
        $this->assertSame(2_080_000, app(DomainPricingService::class)->customerPrice($pricing, 1_600_000));
    }

    public function test_fixed_customer_price_overrides_the_cost_plus_calculation(): void
    {
        $pricing = new DomainPricing(['markup_type' => 'fixed_customer_price', 'fixed_customer_price_kobo' => 2_300_000]);

        $this->assertSame(2_300_000, app(DomainPricingService::class)->customerPrice($pricing, 999_999_999));
    }

    public function test_vat_is_never_baked_into_the_stored_customer_price(): void
    {
        $this->activateDomainPricing('.com', ['registration_price_kobo' => 2_000_000, 'markup_value_kobo' => 300_000]);

        $breakdown = app(DomainPricingService::class)->breakdownFor('.com', 'registration');

        // 2,300,000 subtotal, VAT is a separate 7.5% line — never folded into the base figure.
        $this->assertSame(2_300_000, $breakdown['taxable_kobo']);
        $this->assertSame(172_500, $breakdown['vat_amount_kobo']);
        $this->assertSame(2_472_500, $breakdown['total_kobo']);
    }

    public function test_missing_exchange_rate_makes_a_cost_plus_tld_not_ready_and_hides_its_price(): void
    {
        DomainPricing::query()->create([
            'tld' => '.xyz',
            'provider' => 'spaceship',
            'status' => 'active',
            'markup_type' => 'cost_plus_markup',
            'markup_value_kobo' => 700_000,
            'registration_price_kobo' => 1_000_000,
            'renewal_price_kobo' => 1_000_000,
            'transfer_price_kobo' => 1_000_000,
            // exchange_rate_to_ngn intentionally left null.
        ]);

        $this->assertNull(app(DomainPricingService::class)->priceFor('.xyz'));
    }

    public function test_a_fixed_customer_price_tld_is_ready_without_any_exchange_rate(): void
    {
        DomainPricing::query()->create([
            'tld' => '.shop',
            'provider' => 'spaceship',
            'status' => 'active',
            'markup_type' => 'fixed_customer_price',
            'fixed_customer_price_kobo' => 2_500_000,
            'registration_price_kobo' => 0,
            'renewal_price_kobo' => 0,
            'transfer_price_kobo' => 0,
        ]);

        $price = app(DomainPricingService::class)->priceFor('.shop');

        $this->assertNotNull($price);
        $this->assertSame(2_500_000, $price['registration_kobo']);
    }

    public function test_missing_tld_price_shows_the_friendly_unavailable_message_at_search(): void
    {
        // No domain_pricing row exists for .dev at all.
        $response = $this->getJson('/api/v1/public/domains/search?domain=freshbrand123.dev')->assertOk();

        $this->assertTrue($response->json('available'));
        $this->assertNull($response->json('registration_price_kobo'));
    }

    public function test_sync_without_an_exchange_rate_configured_fails_safely_and_leaves_existing_prices_untouched(): void
    {
        DomainPricingSettings::forProvider('spaceship'); // no exchange_rate set

        DomainPricing::query()->create([
            'tld' => '.com',
            'provider' => 'spaceship',
            'status' => 'active',
            'markup_type' => 'cost_plus_markup',
            'markup_value_kobo' => 700_000,
            'exchange_rate_to_ngn' => 1,
            'registration_price_kobo' => 5_000_000,
            'renewal_price_kobo' => 5_000_000,
            'transfer_price_kobo' => 5_000_000,
        ]);

        $log = app(SpaceshipTldPricingSyncService::class)->sync('manual');

        $this->assertSame('failed', $log->status);
        $this->assertNotNull($log->error_message);

        $com = DomainPricing::where('tld', '.com')->firstOrFail();
        $this->assertSame(5_000_000, $com->registration_price_kobo);
    }

    public function test_manual_sync_endpoint_dispatches_and_the_job_logs_the_run(): void
    {
        $this->seed();
        $this->configureFxSettings();

        $this->withToken($this->domainAdminToken())->postJson('/api/v1/admin/domain-pricing/sync')->assertOk();

        // QUEUE_CONNECTION=sync in phpunit.xml, so the job already ran inline.
        $this->assertSame(1, DomainPricingSyncLog::count());
        $this->assertGreaterThan(0, DomainPricing::where('provider', 'spaceship')->count());
    }

    public function test_admin_can_edit_markup_and_it_recalculates_the_customer_price_and_is_audited(): void
    {
        $this->seed();
        $this->configureFxSettings();
        app(SpaceshipTldPricingSyncService::class)->sync('manual');
        $com = DomainPricing::where('tld', '.com')->firstOrFail();

        $response = $this->withToken($this->domainAdminToken())->putJson("/api/v1/admin/domain-pricing/{$com->id}", [
            'tld' => '.com',
            'provider' => 'spaceship',
            'currency' => 'NGN',
            'registration_price_kobo' => $com->registration_price_kobo,
            'renewal_price_kobo' => $com->renewal_price_kobo,
            'transfer_price_kobo' => $com->transfer_price_kobo,
            'markup_type' => 'cost_plus_markup',
            'markup_value_kobo' => 900_000,
            'status' => 'active',
        ])->assertOk();

        $this->assertSame($com->registration_price_kobo + 900_000, $response->json('customer_registration_price_kobo'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'domain_pricing_updated']);
    }

    public function test_spaceship_api_secrets_are_never_logged_during_a_tld_pricing_sync(): void
    {
        $this->configureFxSettings();
        config(['services.spaceship.api_key' => 'SECRET-PRICING-KEY']);
        config(['services.spaceship.api_secret' => 'SECRET-PRICING-SECRET']);

        app(SpaceshipTldPricingSyncService::class)->sync('manual');

        $summaries = DomainSyncLog::where('action', 'tld_pricing_sync')->pluck('response_summary');
        $this->assertNotEmpty($summaries);

        foreach ($summaries as $summary) {
            $encoded = json_encode($summary);
            $this->assertStringNotContainsString('SECRET-PRICING-KEY', $encoded);
            $this->assertStringNotContainsString('SECRET-PRICING-SECRET', $encoded);
        }
    }
}
