<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\User;
use App\Services\Payments\SavedPaymentMethodService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class SavedCardPaymentTest extends TestCase
{
    use FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    private function createUnpaidInvoiceWithSavedCard(string $email): array
    {
        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Saved Card Client',
            'email' => $email,
            'password' => 'secret-password',
            'phone' => '08000000088',
        ])->assertCreated()->json('token');
        $user = User::query()->where('email', $email)->firstOrFail();
        $user->forceFill(['email_verified_at' => now()])->save();

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => str_replace(['@', '.'], '-', $email).'.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $this->assertSame(10_750_000, $checkout->json('invoice.total_kobo'));

        $card = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($user->client, 'paystack', [
            'authorization' => ['authorization_code' => 'AUTH_saved_card_test', 'reusable' => true, 'last4' => '4242', 'brand' => 'visa'],
        ]);

        return ['token' => $token, 'checkout' => $checkout, 'card' => $card];
    }

    public function test_paying_with_a_saved_card_marks_the_invoice_paid_and_queues_provisioning(): void
    {
        $this->seed();
        ['token' => $token, 'checkout' => $checkout, 'card' => $card] = $this->createUnpaidInvoiceWithSavedCard('saved-card-pay@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        Http::fake([
            'api.paystack.co/transaction/charge_authorization' => Http::response([
                'status' => true,
                'data' => ['status' => 'success', 'amount' => 10_750_000, 'currency' => 'NGN', 'reference' => 'card-ref'],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/saved-card/{$card->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Payment successful using your saved card.');

        $this->assertDatabaseHas('invoices', [
            'invoice_number' => $invoiceNumber,
            'status' => 'paid',
            'amount_paid_kobo' => 10_750_000,
        ]);

        $this->assertDatabaseHas('hosting_services', [
            'primary_domain' => $checkout->json('service.primary_domain'),
            'provisioning_status' => 'provisioned',
        ]);
    }

    public function test_a_declined_saved_card_charge_does_not_mark_the_invoice_paid(): void
    {
        $this->seed();
        ['token' => $token, 'checkout' => $checkout, 'card' => $card] = $this->createUnpaidInvoiceWithSavedCard('saved-card-decline@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        Http::fake([
            'api.paystack.co/transaction/charge_authorization' => Http::response([
                'status' => true,
                'data' => ['status' => 'failed', 'amount' => 10_750_000, 'currency' => 'NGN', 'reference' => 'card-ref'],
            ], 200),
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/saved-card/{$card->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('invoices', ['invoice_number' => $invoiceNumber, 'status' => 'unpaid']);
    }

    public function test_a_disabled_saved_card_cannot_be_charged(): void
    {
        $this->seed();
        ['token' => $token, 'checkout' => $checkout, 'card' => $card] = $this->createUnpaidInvoiceWithSavedCard('saved-card-disabled@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $card->forceFill(['is_active' => false])->save();

        Http::fake();

        $this->withToken($token)
            ->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/saved-card/{$card->id}")
            ->assertStatus(422);

        Http::assertNothingSent();
        $this->assertDatabaseHas('invoices', ['invoice_number' => $invoiceNumber, 'status' => 'unpaid']);
    }

    public function test_a_client_cannot_pay_with_another_clients_saved_card(): void
    {
        $this->seed();
        ['checkout' => $checkout] = $this->createUnpaidInvoiceWithSavedCard('saved-card-owner@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->app['auth']->forgetGuards();
        $intruderToken = $this->postJson('/api/v1/auth/register', [
            'name' => 'Intruder', 'email' => 'saved-card-intruder@example.test', 'password' => 'secret-password', 'phone' => '08000000077',
        ])->assertCreated()->json('token');
        $intruderUser = User::query()->where('email', 'saved-card-intruder@example.test')->firstOrFail();
        $intruderUser->forceFill(['email_verified_at' => now()])->save();

        $intruderCard = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($intruderUser->client, 'paystack', [
            'authorization' => ['authorization_code' => 'AUTH_intruder_card', 'reusable' => true, 'last4' => '0000'],
        ]);

        $this->app['auth']->forgetGuards();

        $this->withToken($intruderToken)
            ->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/saved-card/{$intruderCard->id}")
            ->assertForbidden();
    }
}
