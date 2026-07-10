<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class WalletPaymentTest extends TestCase
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
            'name' => 'Wallet Payment Client',
            'email' => $email,
            'password' => 'secret-password',
            'phone' => '08000000066',
        ])->assertCreated()->json('token');

        User::query()->where('email', $email)->firstOrFail()->forceFill(['email_verified_at' => now()])->save();

        return $token;
    }

    private function createUnpaidInvoice(string $email): array
    {
        $token = $this->registerVerifiedClient($email);

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => str_replace(['@', '.'], '-', $email).'.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $this->assertSame(10_750_000, $checkout->json('invoice.total_kobo'));

        return ['token' => $token, 'checkout' => $checkout];
    }

    public function test_pay_with_wallet_completes_invoice_when_balance_covers_the_full_total(): void
    {
        $this->seed();
        ['token' => $token, 'checkout' => $checkout] = $this->createUnpaidInvoice('wallet-full-pay@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();

        app(WalletService::class)->credit($invoice->client, 10_750_000, 'wallet_topup');

        $response = $this->withToken($token)
            ->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/wallet")
            ->assertOk();

        $this->assertSame(0, $response->json('remaining_kobo'));

        $this->assertDatabaseHas('invoices', [
            'invoice_number' => $invoiceNumber,
            'status' => 'paid',
            'amount_paid_kobo' => 10_750_000,
            'outstanding_amount_kobo' => 0,
        ]);

        $wallet = Wallet::where('client_id', $invoice->client_id)->firstOrFail();
        $this->assertSame(0, $wallet->balance_kobo);

        $this->assertDatabaseHas('hosting_services', [
            'primary_domain' => $checkout->json('service.primary_domain'),
            'provisioning_status' => 'provisioned',
        ]);
    }

    public function test_pay_with_wallet_only_applies_a_partial_amount_when_balance_is_insufficient(): void
    {
        $this->seed();
        ['token' => $token, 'checkout' => $checkout] = $this->createUnpaidInvoice('wallet-split-pay@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();

        // Wallet balance ₦40,000 against a ₦107,500 invoice => ₦67,500 remaining.
        app(WalletService::class)->credit($invoice->client, 4_000_000, 'wallet_topup');

        $response = $this->withToken($token)
            ->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/wallet")
            ->assertOk();

        $this->assertSame(6_750_000, $response->json('remaining_kobo'));
        $this->assertSame(4_000_000, $response->json('wallet_amount_applied_kobo'));

        $invoice->refresh();
        $this->assertSame('partially_paid', $invoice->status);
        $this->assertSame(4_000_000, $invoice->amount_paid_kobo);
        $this->assertSame(6_750_000, $invoice->outstanding_amount_kobo);

        $wallet = Wallet::where('client_id', $invoice->client_id)->firstOrFail();
        $this->assertSame(0, $wallet->balance_kobo);

        // The invoice must not be marked paid, and provisioning must not be queued.
        $this->assertDatabaseHas('hosting_services', [
            'primary_domain' => $checkout->json('service.primary_domain'),
            'provisioning_status' => 'not_provisioned',
        ]);
    }

    public function test_pay_with_wallet_is_rejected_when_wallet_balance_is_empty(): void
    {
        $this->seed();
        ['token' => $token, 'checkout' => $checkout] = $this->createUnpaidInvoice('wallet-empty-pay@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($token)
            ->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/wallet")
            ->assertStatus(422);
    }
}
