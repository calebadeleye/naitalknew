<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class InvoiceDetailApiTest extends TestCase
{
    use FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    private function registerVerifiedClient(string $email): string
    {
        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Invoice Test Client',
            'email' => $email,
            'password' => 'secret-password',
            'phone' => '08000000077',
        ])->assertCreated()->json('token');

        User::query()->where('email', $email)->firstOrFail()->forceFill(['email_verified_at' => now()])->save();

        return $token;
    }

    public function test_checkout_applies_vat_and_no_automatic_discount(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('vat-check-client@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'vat-check-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $this->assertSame(10000000, $checkout->json('order.subtotal_kobo'));
        $this->assertSame(0, $checkout->json('order.discount_kobo'));
        $this->assertSame(750000, $checkout->json('order.tax_kobo'));
        $this->assertSame(10750000, $checkout->json('order.total_kobo'));
    }

    public function test_client_can_view_their_own_invoice_with_correct_totals(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('invoice-view-client@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'invoice-view-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $orderNumber = $checkout->json('order.order_number');

        $this->withToken($token)->getJson("/api/v1/client/orders/{$orderNumber}/invoice")
            ->assertOk()
            ->assertJsonPath('invoice_number', $checkout->json('invoice.invoice_number'))
            ->assertJsonPath('status', 'unpaid')
            ->assertJsonPath('from.name', config('company.name'))
            ->assertJsonPath('subtotal', '₦100,000')
            ->assertJsonPath('tax', '₦7,500')
            ->assertJsonPath('total', '₦107,500')
            ->assertJsonCount(1, 'line_items');
    }

    public function test_a_client_cannot_view_another_clients_invoice(): void
    {
        $this->seed();

        $ownerToken = $this->registerVerifiedClient('invoice-owner@example.test');
        $checkout = $this->withToken($ownerToken)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'starter-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'invoice-owner-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $intruderToken = $this->registerVerifiedClient('invoice-intruder@example.test');

        // The sanctum guard caches the first resolved user for the lifetime of the
        // test's container instance; force a fresh resolution now that we're
        // switching from the owner's token to the intruder's token.
        $this->app['auth']->forgetGuards();

        $this->withToken($intruderToken)
            ->getJson("/api/v1/client/orders/{$checkout->json('order.order_number')}/invoice")
            ->assertNotFound();
    }
}
