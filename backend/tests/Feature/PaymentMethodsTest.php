<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payments\PaymentMethodSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class PaymentMethodsTest extends TestCase
{
    use FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
        Notification::fake();
        $this->seed();
        config(['services.paystack.secret_key' => 'sk_test_env', 'services.flutterwave.secret_key' => 'FLWSECK_TEST-env', 'app.url' => 'https://api.naitalk.test', 'app.frontend_url' => 'https://www.naitalk.test']);
    }

    private function adminToken(): string
    {
        $this->app['auth']->forgetGuards();

        $admin = User::query()->firstOrCreate(['email' => 'payments-admin@example.test'], [
            'name' => 'Payments Admin', 'role' => 'super_admin', 'account_status' => 'active', 'email_verified_at' => now(), 'password' => 'password',
        ]);

        return $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'password'])->assertOk()->json('token');
    }

    /** @return array{token: string, invoice: string} */
    private function unpaidInvoice(string $email): array
    {
        $this->app['auth']->forgetGuards();
        $token = $this->postJson('/api/v1/auth/register', [
            'terms_accepted' => true, 'name' => 'Payment Methods Client', 'email' => $email, 'password' => 'secret-password', 'phone' => '08000000066',
        ])->assertCreated()->json('token');
        User::query()->where('email', $email)->firstOrFail()->forceFill(['email_verified_at' => now()])->save();

        $invoice = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'professional-website-care', 'billing_cycle' => 'annual', 'primary_domain' => str_replace(['@', '.'], '-', $email).'.com', 'terms_accepted' => true,
        ])->assertCreated()->json('invoice.invoice_number');

        return ['token' => $token, 'invoice' => $invoice];
    }

    private function enableStripe(array $values = []): void
    {
        $this->withToken($this->adminToken())->putJson('/api/v1/admin/settings/payment-methods/stripe', [
            'enabled' => true,
            'values' => $values + ['secret_key' => 'sk_test_stripe_1234', 'webhook_secret' => 'whsec_test', 'currency' => 'USD', 'ngn_rate' => '1600'],
        ])->assertOk();
    }

    public function test_out_of_the_box_clients_see_paystack_flutterwave_and_bank_transfer_only(): void
    {
        ['token' => $token] = $this->unpaidInvoice('defaults@example.test');

        $methods = collect($this->withToken($token)->getJson('/api/v1/client/payment-options')->assertOk()->json('methods'))->pluck('method')->all();

        $this->assertSame(['paystack', 'flutterwave', 'bank_transfer'], $methods);
    }

    public function test_admin_sees_secrets_only_as_a_hint_and_they_are_stored_encrypted(): void
    {
        $this->enableStripe();

        $stripe = collect($this->withToken($this->adminToken())->getJson('/api/v1/admin/settings/payment-methods')->assertOk()->json('methods'))->firstWhere('method', 'stripe');
        $secret = collect($stripe['fields'])->firstWhere('name', 'secret_key');

        $this->assertTrue($stripe['enabled']);
        $this->assertTrue($stripe['configured']);
        $this->assertNull($secret['value']);
        $this->assertSame('••••1234', $secret['hint']);
        $this->assertStringNotContainsString('sk_test_stripe_1234', json_encode(AppSetting::get(PaymentMethodSettings::SETTING_KEY)));
        $this->assertDatabaseHas('audit_logs', ['action' => 'payment_method_updated']);
    }

    public function test_saving_without_retyping_a_secret_keeps_it(): void
    {
        $this->enableStripe();
        $this->withToken($this->adminToken())->putJson('/api/v1/admin/settings/payment-methods/stripe', [
            'enabled' => true, 'values' => ['secret_key' => '', 'ngn_rate' => '1500'],
        ])->assertOk();

        $this->assertSame('sk_test_stripe_1234', app(PaymentMethodSettings::class)->value('stripe', 'secret_key'));
        $this->assertSame(1500.0, app(PaymentMethodSettings::class)->ngnRate('stripe'));
    }

    public function test_a_switched_off_method_is_hidden_and_refused(): void
    {
        $this->withToken($this->adminToken())->putJson('/api/v1/admin/settings/payment-methods/paystack', ['enabled' => false])->assertOk();
        ['token' => $token, 'invoice' => $invoice] = $this->unpaidInvoice('paystack-off@example.test');

        $methods = collect($this->withToken($token)->getJson('/api/v1/client/payment-options')->json('methods'))->pluck('method');
        $this->assertFalse($methods->contains('paystack'));
        $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoice}/pay/paystack")->assertStatus(422);
    }

    public function test_a_foreign_currency_gateway_without_a_rate_is_not_offered(): void
    {
        $this->enableStripe(['ngn_rate' => '']);
        AppSetting::put(PaymentMethodSettings::SETTING_KEY, array_replace_recursive(AppSetting::get(PaymentMethodSettings::SETTING_KEY), ['stripe' => ['values' => ['ngn_rate' => '']]]));
        ['token' => $token] = $this->unpaidInvoice('no-rate@example.test');

        $this->assertFalse(collect($this->withToken($token)->getJson('/api/v1/client/payment-options')->json('methods'))->pluck('method')->contains('stripe'));
    }

    public function test_stripe_charges_the_converted_amount_and_marks_the_invoice_paid_once_stripe_confirms_it(): void
    {
        $this->enableStripe();
        ['token' => $token, 'invoice' => $invoice] = $this->unpaidInvoice('stripe-pays@example.test');
        // ₦107,500 at ₦1,600/$ = $67.1875 → rounded up to $67.19.
        Http::fake([
            'api.stripe.com/v1/checkout/sessions' => Http::response(['id' => 'cs_test_1', 'url' => 'https://checkout.stripe.test/cs_test_1']),
            'api.stripe.com/v1/checkout/sessions/cs_test_1' => Http::response(['id' => 'cs_test_1', 'payment_status' => 'paid', 'status' => 'complete', 'amount_total' => 6719, 'currency' => 'usd']),
        ]);

        $start = $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoice}/pay/stripe")->assertOk();
        $this->assertSame('https://checkout.stripe.test/cs_test_1', $start->json('redirect_url'));
        Http::assertSent(fn ($request) => $request->url() === 'https://api.stripe.com/v1/checkout/sessions' && $request['line_items[0][price_data][unit_amount]'] == 6719 && $request['line_items[0][price_data][currency]'] === 'usd');

        $this->get('/api/v1/payments/stripe/callback?reference='.$start->json('reference'))
            ->assertRedirect('https://www.naitalk.test/client/orders?payment=success&invoice='.$invoice);

        $this->assertSame('paid', Invoice::where('invoice_number', $invoice)->value('status'));
        $this->assertSame(10_750_000, (int) Payment::where('reference', $start->json('reference'))->value('amount_kobo'));
    }

    public function test_a_stripe_payment_for_less_than_was_asked_does_not_pay_the_invoice(): void
    {
        $this->enableStripe();
        ['token' => $token, 'invoice' => $invoice] = $this->unpaidInvoice('stripe-short@example.test');
        Http::fake([
            'api.stripe.com/v1/checkout/sessions' => Http::response(['id' => 'cs_test_2', 'url' => 'https://checkout.stripe.test/cs_test_2']),
            'api.stripe.com/v1/checkout/sessions/cs_test_2' => Http::response(['id' => 'cs_test_2', 'payment_status' => 'paid', 'amount_total' => 100, 'currency' => 'usd']),
        ]);

        $reference = $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoice}/pay/stripe")->assertOk()->json('reference');
        $this->get('/api/v1/payments/stripe/callback?reference='.$reference)->assertRedirect();

        $this->assertNotSame('paid', Invoice::where('invoice_number', $invoice)->value('status'));
        $this->assertSame('failed', Payment::where('reference', $reference)->value('status'));
    }

    public function test_stripe_webhooks_need_a_valid_signature(): void
    {
        $this->enableStripe();
        ['token' => $token, 'invoice' => $invoice] = $this->unpaidInvoice('stripe-webhook@example.test');
        Http::fake([
            'api.stripe.com/v1/checkout/sessions' => Http::response(['id' => 'cs_test_3', 'url' => 'https://checkout.stripe.test/cs_test_3']),
            'api.stripe.com/v1/checkout/sessions/cs_test_3' => Http::response(['id' => 'cs_test_3', 'payment_status' => 'paid', 'amount_total' => 6719, 'currency' => 'usd']),
        ]);
        $reference = $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoice}/pay/stripe")->json('reference');
        $payload = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => ['id' => 'cs_test_3', 'metadata' => ['reference' => $reference]]]]);

        $this->call('POST', '/api/v1/payments/stripe/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_STRIPE_SIGNATURE' => 't='.time().',v1=forged'], $payload)->assertStatus(401);
        $this->assertNotSame('paid', Invoice::where('invoice_number', $invoice)->value('status'));

        $time = time();
        $signature = hash_hmac('sha256', $time.'.'.$payload, 'whsec_test');
        $this->call('POST', '/api/v1/payments/stripe/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_STRIPE_SIGNATURE' => "t={$time},v1={$signature}"], $payload)->assertOk();
        $this->assertSame('paid', Invoice::where('invoice_number', $invoice)->value('status'));
    }

    public function test_paypal_is_captured_on_return_and_pays_the_invoice(): void
    {
        $this->withToken($this->adminToken())->putJson('/api/v1/admin/settings/payment-methods/paypal', [
            'enabled' => true, 'values' => ['client_id' => 'pp-client', 'client_secret' => 'pp-secret', 'mode' => 'sandbox', 'currency' => 'USD', 'ngn_rate' => '1600'],
        ])->assertOk();
        ['token' => $token, 'invoice' => $invoice] = $this->unpaidInvoice('paypal-pays@example.test');
        Http::fake([
            'api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response(['access_token' => 'A21-token']),
            'api-m.sandbox.paypal.com/v2/checkout/orders' => Http::response(['id' => 'ORDER-1', 'links' => [['rel' => 'approve', 'href' => 'https://sandbox.paypal.test/approve/ORDER-1']]], 201),
            'api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1/capture' => Http::response([
                'id' => 'ORDER-1', 'status' => 'COMPLETED',
                'purchase_units' => [['payments' => ['captures' => [['id' => 'CAP-1', 'status' => 'COMPLETED', 'amount' => ['currency_code' => 'USD', 'value' => '67.19']]]]]],
            ], 201),
        ]);

        $start = $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoice}/pay/paypal")->assertOk();
        $this->assertSame('https://sandbox.paypal.test/approve/ORDER-1', $start->json('redirect_url'));
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/v2/checkout/orders') && $request['purchase_units'][0]['amount'] === ['currency_code' => 'USD', 'value' => '67.19']);

        $this->get('/api/v1/payments/paypal/callback?reference='.$start->json('reference').'&token=ORDER-1&PayerID=X')
            ->assertRedirect('https://www.naitalk.test/client/orders?payment=success&invoice='.$invoice);
        $this->assertSame('paid', Invoice::where('invoice_number', $invoice)->value('status'));
    }
}
