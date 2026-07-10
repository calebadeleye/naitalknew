<?php

namespace Tests\Feature;

use App\Services\Billing\VatCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VatCalculationTest extends TestCase
{
    use RefreshDatabase;

    public function test_vat_is_calculated_at_7_5_percent_by_default(): void
    {
        $result = (new VatCalculator)->calculate(100_000_00);

        $this->assertSame(0.075, $result['vat_rate']);
        $this->assertSame(750_000, $result['vat_amount_kobo']);
        $this->assertSame(10_750_000, $result['total_kobo']);
    }

    public function test_vat_applies_after_discount(): void
    {
        $result = (new VatCalculator)->calculate(100_000_00, 10_000_00);

        $this->assertSame(90_000_00, $result['taxable_kobo']);
        $this->assertSame(675_000, $result['vat_amount_kobo']);
        $this->assertSame(9_675_000, $result['total_kobo']);
    }

    public function test_public_billing_config_exposes_the_backend_vat_rate(): void
    {
        $this->getJson('/api/v1/public/billing-config')
            ->assertOk()
            ->assertJsonPath('vat_rate', 0.075);
    }

    public function test_matches_stored_totals_detects_a_tampered_total(): void
    {
        $calculator = new VatCalculator;

        $this->assertTrue($calculator->matchesStoredTotals(100_000_00, 0, 0.075, 750_000, 10_750_000));
        $this->assertFalse($calculator->matchesStoredTotals(100_000_00, 0, 0.075, 750_000, 1));
    }
}
