<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Invoice;
use App\Services\Billing\VatCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\TestCase;

class VatSettingTest extends TestCase
{
    use CreatesDomainFixtures, RefreshDatabase;

    private function checkout(string $token, string $domain)
    {
        return $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'professional-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => $domain,
            'terms_accepted' => true,
        ])->assertCreated();
    }

    public function test_vat_is_on_by_default(): void
    {
        $this->assertTrue(VatCalculator::isEnabled());
        $this->assertSame(0.075, VatCalculator::currentRate());
    }

    public function test_admin_can_switch_vat_off_and_on_and_it_is_audited(): void
    {
        $this->seed();
        $admin = $this->domainAdminToken();

        $this->withToken($admin)->getJson('/api/v1/admin/settings/billing')
            ->assertOk()->assertJsonPath('vat_enabled', true)->assertJsonPath('current_vat_rate', 0.075);

        $this->withToken($admin)->putJson('/api/v1/admin/settings/billing', ['vat_enabled' => false])
            ->assertOk()->assertJsonPath('vat_enabled', false)->assertJsonPath('current_vat_rate', 0)
            ->assertJsonPath('configured_vat_rate', 0.075);

        $this->getJson('/api/v1/public/billing-config')
            ->assertOk()->assertJsonPath('vat_rate', 0)->assertJsonPath('vat_enabled', false);
        $this->assertDatabaseHas('audit_logs', ['action' => 'vat_setting_changed']);

        $this->withToken($admin)->putJson('/api/v1/admin/settings/billing', ['vat_enabled' => true])->assertOk()->assertJsonPath('vat_enabled', true);
        $this->getJson('/api/v1/public/billing-config')->assertJsonPath('vat_rate', 0.075);
    }

    public function test_clients_cannot_change_the_vat_setting(): void
    {
        $this->seed();
        ['token' => $token] = $this->registerVerifiedDomainClient('vat-client@example.test');

        $this->withToken($token)->putJson('/api/v1/admin/settings/billing', ['vat_enabled' => false])->assertForbidden();
        $this->assertTrue(VatCalculator::isEnabled());
    }

    public function test_new_orders_carry_no_vat_when_it_is_off_but_earlier_invoices_keep_theirs(): void
    {
        $this->seed();
        ['token' => $token] = $this->registerVerifiedDomainClient('vat-off@example.test');

        // Created while VAT is on: ₦100,000 + 7.5%.
        $before = $this->checkout($token, 'vat-before.com');
        $this->assertSame(10_750_000, $before->json('invoice.total_kobo'));

        AppSetting::put(VatCalculator::SETTING_KEY, false);

        $after = $this->checkout($token, 'vat-after.com');
        $this->assertSame(10_000_000, $after->json('invoice.total_kobo'));
        $this->assertSame(0, Invoice::where('invoice_number', $after->json('invoice.invoice_number'))->value('tax_kobo'));

        // The earlier invoice is untouched and still reconciles at its own rate.
        $this->assertSame(10_750_000, Invoice::where('invoice_number', $before->json('invoice.invoice_number'))->value('total_kobo'));
        $admin = $this->domainAdminToken();
        $this->withToken($admin)->postJson('/api/v1/admin/invoices/'.$before->json('invoice.invoice_number').'/mark-paid')->assertOk();
        $this->assertSame('paid', Invoice::where('invoice_number', $before->json('invoice.invoice_number'))->value('status'));
    }

    public function test_manual_invoice_never_adds_vat_while_it_is_off_even_if_the_box_is_ticked(): void
    {
        $this->seed();
        ['client' => $client] = $this->registerVerifiedDomainClient('vat-manual@example.test');
        $admin = $this->domainAdminToken();
        AppSetting::put(VatCalculator::SETTING_KEY, false);

        $response = $this->withToken($admin)->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'Fee', 'quantity' => 1, 'unit_price_kobo' => 5_000_000]],
            'due_at' => now()->addWeek()->toDateString(),
            'apply_vat' => true,
        ])->assertCreated();

        $this->assertSame(5_000_000, $response->json('data.total_kobo'));
        $this->assertSame(0, $response->json('data.tax_kobo'));
    }
}
