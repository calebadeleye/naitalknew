<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class HostingPlatformApiTest extends TestCase
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
            'name' => 'Verified Client',
            'email' => $email,
            'password' => 'secret-password',
            'phone' => '08000000099',
        ])->assertCreated()->json('token');

        User::query()->where('email', $email)->firstOrFail()->forceFill(['email_verified_at' => now()])->save();

        return $token;
    }

    public function test_public_hosting_plans_are_available(): void
    {
        $this->seed();

        $this->getJson('/api/v1/public/hosting-plans')
            ->assertOk()
            ->assertJsonFragment(['slug' => 'business-website-care']);
    }

    public function test_admin_can_access_dashboard_with_sanctum_token(): void
    {
        $this->seed();

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');

        $this->withToken($token)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure(['metrics', 'upcoming_renewals', 'recent_payments', 'recent_orders']);
    }

    public function test_client_can_access_own_dashboard(): void
    {
        $this->seed();

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'john@naitalk.test',
            'password' => 'password',
        ])->assertOk()->json('token');

        $this->withToken($token)
            ->getJson('/api/v1/client/dashboard')
            ->assertOk()
            ->assertJsonPath('client.email', 'john@naitalk.test')
            ->assertJsonStructure(['metrics', 'services', 'recent_invoice']);
    }

    public function test_registered_user_can_exist_without_ispconfig_mapping(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Prospect User',
            'email' => 'prospect-user@example.test',
            'password' => 'secret-password',
            'phone' => '08000000009',
        ])->assertCreated();

        $this->assertDatabaseHas('clients', [
            'billing_email' => 'prospect-user@example.test',
            'account_type' => 'registered_user',
        ]);
        $this->assertDatabaseCount('ispconfig_client_mappings', 0);

        $this->withToken($response->json('token'))
            ->getJson('/api/v1/client/dashboard')
            ->assertOk()
            ->assertJsonPath('empty_state.title', 'You do not have an active hosting service yet.')
            ->assertJsonCount(0, 'services');
    }

    public function test_checkout_creates_order_invoice_and_service(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('ada@example.test');

        $response = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'example.com',
            'add_ons' => ['website-migration'],
            'auto_renew' => true,
            'payment_gateway' => 'paystack',
            'terms_accepted' => true,
        ])
            ->assertCreated()
            ->assertJsonStructure(['order', 'invoice', 'service']);

        $this->assertDatabaseHas('hosting_services', [
            'primary_domain' => 'example.com',
            'status' => 'pending_payment',
            'provisioning_status' => 'not_provisioned',
        ]);
        $this->assertDatabaseMissing('ispconfig_client_mappings', ['client_id' => $response->json('order.client_id')]);
    }

    public function test_checkout_without_a_primary_domain_is_rejected(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('no-domain-client@example.test');

        $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'terms_accepted' => true,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['primary_domain']);
    }

    public function test_invoice_created_email_is_queued_so_the_client_can_pay_later(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $this->seed();

        $token = $this->registerVerifiedClient('pay-later-client@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'starter-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'pay-later-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $user = \App\Models\User::query()->where('email', 'pay-later-client@example.test')->firstOrFail();

        \Illuminate\Support\Facades\Notification::assertSentTo(
            $user,
            \App\Notifications\NaiTalkInvoiceCreated::class,
            fn ($notification) => $notification->invoice->invoice_number === $checkout->json('invoice.invoice_number'),
        );

        // The invoice stays unpaid and the hosting service stays on hold until a
        // payment is actually verified — "pay later" is a real, first-class path.
        $this->assertDatabaseHas('invoices', ['invoice_number' => $checkout->json('invoice.invoice_number'), 'status' => 'unpaid']);
        $this->assertDatabaseHas('hosting_services', ['order_id' => $checkout->json('order.id'), 'status' => 'pending_payment']);
    }

    public function test_gateway_rejection_returns_a_clean_error_instead_of_crashing(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('gateway-rejects-client@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'starter-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'gateway-rejects-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => false, 'message' => 'Invalid Email Address Passed'], 400),
        ]);

        $this->withToken($token)
            ->postJson("/api/v1/client/invoices/{$checkout->json('invoice.invoice_number')}/pay/paystack")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Invalid Email Address Passed');

        // No dangling "pending" payment row should be left behind for a failed initialization.
        $invoiceId = \App\Models\Invoice::where('invoice_number', $checkout->json('invoice.invoice_number'))->firstOrFail()->id;
        $this->assertDatabaseMissing('payments', ['invoice_id' => $invoiceId]);
    }

    public function test_unverified_client_cannot_checkout_or_pay(): void
    {
        $this->seed();

        // A real invoice must exist for the route-model binding to resolve before
        // the `verified` middleware gate is evaluated; John's seeded invoice works
        // fine here since the unverified client should never even reach the
        // ownership check.
        $existingInvoice = \App\Models\Invoice::query()->first();

        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Unverified Client',
            'email' => 'unverified-client@example.test',
            'password' => 'secret-password',
            'phone' => '08000000010',
        ])->assertCreated()->json('token');

        $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'terms_accepted' => true,
        ])->assertForbidden();

        $this->withToken($token)->postJson("/api/v1/client/invoices/{$existingInvoice->invoice_number}/pay/paystack")
            ->assertForbidden();

        $this->withToken($token)->getJson('/api/v1/client/services/catalog')->assertOk();
    }

    private function fakePaystackSuccess(int $amountKobo): void
    {
        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response([
                'status' => true,
                'data' => ['authorization_url' => 'https://paystack.test/pay/abc', 'access_code' => 'code', 'reference' => 'placeholder'],
            ], 200),
            'api.paystack.co/transaction/verify/*' => Http::response([
                'status' => true,
                'data' => ['status' => 'success', 'amount' => $amountKobo, 'currency' => 'NGN', 'reference' => 'placeholder'],
            ], 200),
        ]);
    }

    public function test_verified_hosting_payment_creates_and_reuses_ispconfig_mapping(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('paid-client@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'paid-example.com',
            'auto_renew' => true,
            'payment_gateway' => 'paystack',
            'terms_accepted' => true,
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $this->fakePaystackSuccess((int) $checkout->json('invoice.total_kobo'));

        $init = $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/paystack")
            ->assertOk()
            ->assertJsonStructure(['authorization_url', 'reference']);

        $this->getJson('/api/v1/payments/paystack/callback?reference='.$init->json('reference'))
            ->assertRedirect();

        $clientId = $checkout->json('order.client_id');
        $this->assertDatabaseHas('invoices', ['invoice_number' => $invoiceNumber, 'status' => 'paid']);
        $this->assertDatabaseHas('clients', ['id' => $clientId, 'account_type' => 'hosting_client']);
        $this->assertDatabaseHas('hosting_services', ['primary_domain' => 'paid-example.com', 'provisioning_status' => 'provisioned']);
        $this->assertDatabaseHas('ispconfig_client_mappings', ['client_id' => $clientId, 'ispconfig_server_id' => 1]);

        $secondCheckout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'starter-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'second-paid-example.com',
            'auto_renew' => true,
            'payment_gateway' => 'paystack',
            'terms_accepted' => true,
        ])->assertCreated();

        $secondInvoiceNumber = $secondCheckout->json('invoice.invoice_number');
        $this->fakePaystackSuccess((int) $secondCheckout->json('invoice.total_kobo'));

        $secondInit = $this->withToken($token)->postJson("/api/v1/client/invoices/{$secondInvoiceNumber}/pay/paystack")->assertOk();

        $this->getJson('/api/v1/payments/paystack/callback?reference='.$secondInit->json('reference'))
            ->assertRedirect();

        $this->assertDatabaseHas('invoices', ['invoice_number' => $secondInvoiceNumber, 'status' => 'paid']);
        $this->assertDatabaseCount('ispconfig_client_mappings', 2); // seeded John + this client, mapping reused across both of this client's orders
        $this->assertDatabaseHas('ispconfig_client_mappings', ['client_id' => $clientId, 'ispconfig_server_id' => 1]);
        $this->assertDatabaseHas('ispconfig_service_mappings', ['hosting_service_id' => $secondCheckout->json('service.id')]);
    }

    public function test_provisioning_is_dispatched_as_a_queued_job_not_run_inline_in_production_queue_mode(): void
    {
        Queue::fake();
        $this->seed();

        $token = $this->registerVerifiedClient('queued-provisioning-client@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'starter-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'queued-example.com',
            'payment_gateway' => 'paystack',
            'terms_accepted' => true,
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $this->fakePaystackSuccess((int) $checkout->json('invoice.total_kobo'));

        $init = $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/paystack")->assertOk();

        $this->getJson('/api/v1/payments/paystack/callback?reference='.$init->json('reference'))->assertRedirect();

        // The web request that verifies payment must never provision synchronously —
        // it only dispatches the job. Confirmed independent of the test-only sync queue driver.
        Queue::assertPushed(ProvisionHostingServiceJob::class, fn ($job) => $job->hostingServiceId === (int) $checkout->json('service.id'));

        $this->assertDatabaseHas('hosting_services', [
            'id' => $checkout->json('service.id'),
            'provisioning_status' => 'awaiting_provisioning',
        ]);
    }

    public function test_paystack_webhook_rejects_invalid_signature(): void
    {
        $this->seed();

        $this->postJson('/api/v1/payments/paystack/webhook', ['data' => ['reference' => 'whatever']])
            ->assertUnauthorized();
    }

    public function test_bank_transfer_returns_account_details_and_does_not_mark_paid(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('bank-transfer-client@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'starter-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'bank-transfer-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/bank-transfer")
            ->assertOk()
            ->assertJsonPath('account_number', '1310414891')
            ->assertJsonPath('bank_name', 'Zenith Bank')
            ->assertJsonPath('reference', $invoiceNumber);

        $this->assertDatabaseHas('invoices', ['invoice_number' => $invoiceNumber, 'status' => 'unpaid']);
        $this->assertDatabaseHas('payments', ['reference' => 'BANK-'.$invoiceNumber, 'status' => 'awaiting_bank_transfer']);
    }

    public function test_admin_can_manually_mark_invoice_paid(): void
    {
        $this->seed();

        $clientToken = $this->registerVerifiedClient('admin-mark-paid-client@example.test');

        $checkout = $this->withToken($clientToken)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'starter-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'admin-mark-paid-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $adminToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');

        // The sanctum guard caches the first resolved user for the lifetime of the
        // test's container instance; force a fresh resolution now that we're
        // switching from the client token to the admin token.
        $this->app['auth']->forgetGuards();

        $this->withToken($adminToken)->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid")->assertOk();

        $this->assertDatabaseHas('invoices', ['invoice_number' => $invoiceNumber, 'status' => 'paid']);
    }

    public function test_client_can_list_own_orders(): void
    {
        $this->seed();

        $token = $this->registerVerifiedClient('order-history@example.test');

        $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'order-history-example.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $this->withToken($token)->getJson('/api/v1/client/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
