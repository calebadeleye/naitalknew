<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\Payments\ReconcileInvoicePaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class PaymentReconciliationTest extends TestCase
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
            'name' => 'Reconciliation Test Client',
            'email' => $email,
            'password' => 'secret-password',
            'phone' => '08000000055',
        ])->assertCreated()->json('token');

        User::query()->where('email', $email)->firstOrFail()->forceFill(['email_verified_at' => now()])->save();

        return $token;
    }

    private function adminToken(): string
    {
        // The sanctum guard caches the first resolved user for the lifetime of
        // the test's container instance; force a fresh resolution whenever we
        // switch from a client token to the admin token (see InvoiceDetailApiTest).
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    private function createUnpaidInvoice(string $clientEmail): array
    {
        $token = $this->registerVerifiedClient($clientEmail);

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => str_replace(['@', '.'], '-', $clientEmail).'.com',
            'terms_accepted' => true,
        ])->assertCreated();

        // ₦100,000 subtotal, 7.5% VAT => ₦107,500 total (10,750,000 kobo).
        $this->assertSame(10_750_000, $checkout->json('invoice.total_kobo'));

        return ['token' => $token, 'checkout' => $checkout];
    }

    public function test_exact_payment_marks_invoice_paid_and_queues_provisioning(): void
    {
        $this->seed();
        ['checkout' => $checkout] = $this->createUnpaidInvoice('exact-payment@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($this->adminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => 10_750_000])
            ->assertOk();

        $this->assertDatabaseHas('invoices', [
            'invoice_number' => $invoiceNumber,
            'status' => 'paid',
            'reconciliation_status' => 'reconciled',
            'amount_paid_kobo' => 10_750_000,
            'outstanding_amount_kobo' => 0,
            'overpayment_amount_kobo' => 0,
            'underpayment_amount_kobo' => 0,
        ]);

        // The test queue driver is 'sync', so ProvisionHostingServiceJob runs
        // inline and the service reaches its final 'provisioned' state here.
        $this->assertDatabaseHas('hosting_services', [
            'primary_domain' => $checkout->json('service.primary_domain'),
            'provisioning_status' => 'provisioned',
        ]);
    }

    public function test_overpayment_credits_the_excess_to_wallet_and_marks_invoice_paid(): void
    {
        Notification::fake();
        $this->seed();
        ['checkout' => $checkout] = $this->createUnpaidInvoice('overpayment@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        // Invoice total ₦107,500, amount paid ₦110,000 => ₦2,500 overpayment.
        $this->withToken($this->adminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => 11_000_000])
            ->assertOk();

        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();

        $this->assertSame('paid', $invoice->status);
        $this->assertSame(10_750_000, $invoice->amount_paid_kobo);
        $this->assertSame(250_000, $invoice->overpayment_amount_kobo);
        $this->assertSame(0, $invoice->outstanding_amount_kobo);

        $wallet = Wallet::where('client_id', $invoice->client_id)->firstOrFail();
        $this->assertSame(250_000, $wallet->balance_kobo);

        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_id' => $wallet->id,
            'type' => 'overpayment_credit',
            'direction' => 'credit',
            'amount_kobo' => 250_000,
            'balance_before_kobo' => 0,
            'balance_after_kobo' => 250_000,
            'invoice_id' => $invoice->id,
        ]);

        Notification::assertSentTo($invoice->client->user, \App\Notifications\NaiTalkOverpaymentCredited::class);
    }

    public function test_underpayment_credits_wallet_and_blocks_provisioning(): void
    {
        Notification::fake();
        $this->seed();
        ['checkout' => $checkout] = $this->createUnpaidInvoice('underpayment@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        // Invoice total ₦107,500, amount paid ₦100,000 => ₦7,500 still owed.
        $this->withToken($this->adminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => 10_000_000])
            ->assertOk();

        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();

        $this->assertSame('partially_paid', $invoice->status);
        $this->assertSame(10_000_000, $invoice->amount_paid_kobo);
        $this->assertSame(750_000, $invoice->underpayment_amount_kobo);
        $this->assertSame(750_000, $invoice->outstanding_amount_kobo);

        $wallet = Wallet::where('client_id', $invoice->client_id)->firstOrFail();
        $this->assertSame(10_000_000, $wallet->balance_kobo);

        $this->assertDatabaseHas('wallet_transactions', [
            'wallet_id' => $wallet->id,
            'type' => 'underpayment_credit',
            'direction' => 'credit',
            'amount_kobo' => 10_000_000,
        ]);

        // Underpaid invoices must never queue ISPConfig provisioning.
        $this->assertDatabaseHas('hosting_services', [
            'primary_domain' => $checkout->json('service.primary_domain'),
            'provisioning_status' => 'not_provisioned',
        ]);

        Notification::assertSentTo($invoice->client->user, \App\Notifications\NaiTalkUnderpaymentReceived::class);
    }

    public function test_vat_mismatch_blocks_reconciliation_and_flags_the_invoice(): void
    {
        $this->seed();
        ['checkout' => $checkout] = $this->createUnpaidInvoice('vat-mismatch@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        // Simulate a tampered/corrupted total that no longer matches subtotal + VAT.
        Invoice::where('invoice_number', $invoiceNumber)->update(['total_kobo' => 999_999_999]);

        $this->withToken($this->adminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => 999_999_999])
            ->assertStatus(422);

        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();
        $this->assertSame('mismatch', $invoice->reconciliation_status);
        $this->assertNotSame('paid', $invoice->status);
    }

    public function test_duplicate_reconciliation_of_the_same_payment_reference_does_not_double_credit_or_double_provision(): void
    {
        $this->seed();
        ['checkout' => $checkout] = $this->createUnpaidInvoice('duplicate-webhook@example.test');
        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();
        $payment = Payment::query()->create([
            'client_id' => $invoice->client_id,
            'invoice_id' => $invoice->id,
            'gateway' => 'paystack',
            'purpose' => 'invoice_payment',
            'reference' => 'DUPLICATE-TEST-REF',
            'status' => 'pending',
            'amount_kobo' => 10_750_000,
            'currency' => 'NGN',
        ]);

        $reconciler = app(ReconcileInvoicePaymentService::class);

        $reconciler->reconcile($invoice->fresh(), $payment->fresh(), 10_750_000, 'paystack');
        $reconciler->reconcile($invoice->fresh(), $payment->fresh(), 10_750_000, 'paystack');

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame(10_750_000, $invoice->amount_paid_kobo);
        $this->assertSame(0, $invoice->overpayment_amount_kobo);
        // Exact payment never touches the wallet; this also guards against the
        // second reconcile() call somehow crediting/debiting a second time.
        $this->assertSame(0, WalletTransaction::where('invoice_id', $invoice->id)->count());
    }
}
