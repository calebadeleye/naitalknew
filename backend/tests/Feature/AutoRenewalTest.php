<?php

namespace Tests\Feature;

use App\Jobs\GenerateRenewalInvoiceJob;
use App\Jobs\ProcessAutoRenewalPaymentJob;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Wallet;
use App\Notifications\NaiTalkAutoRenewalSuccess;
use App\Notifications\NaiTalkRenewalPaymentReminder;
use App\Services\Payments\SavedPaymentMethodService;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class AutoRenewalTest extends TestCase
{
    use FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    /**
     * Checks out and pays for a real hosting service so it's 'active' and
     * provisioned, then rewinds its renews_at into the renewal lead window
     * so the auto-renewal pipeline picks it up.
     */
    private function createActiveServiceDueForRenewal(string $email): HostingService
    {
        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Auto Renewal Client',
            'email' => $email,
            'password' => 'secret-password',
            'phone' => '08000000033',
        ])->assertCreated()->json('token');
        User::query()->where('email', $email)->firstOrFail()->forceFill(['email_verified_at' => now()])->save();

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => str_replace(['@', '.'], '-', $email).'.com',
            'auto_renew' => true,
            'terms_accepted' => true,
        ])->assertCreated();

        Http::fake([
            'api.paystack.co/transaction/initialize' => Http::response(['status' => true, 'data' => ['authorization_url' => 'https://paystack.test', 'reference' => 'x']], 200),
            'api.paystack.co/transaction/verify/*' => Http::response(['status' => true, 'data' => ['status' => 'success', 'amount' => $checkout->json('invoice.total_kobo'), 'currency' => 'NGN']], 200),
        ]);

        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $init = $this->withToken($token)->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/paystack")->assertOk();
        $this->getJson('/api/v1/payments/paystack/callback?reference='.$init->json('reference'))->assertRedirect();

        $service = HostingService::where('id', $checkout->json('service.id'))->firstOrFail();
        $service->forceFill(['renews_at' => now()->addDays(3)->toDateString()])->save();

        return $service->fresh();
    }

    private function runAutoRenewalPipeline(): void
    {
        app()->call([app(GenerateRenewalInvoiceJob::class), 'handle']);
        app()->call([app(ProcessAutoRenewalPaymentJob::class), 'handle']);
    }

    public function test_auto_renewal_checks_wallet_first_and_pays_in_full_from_wallet(): void
    {
        Notification::fake();
        $this->seed();

        $service = $this->createActiveServiceDueForRenewal('renewal-wallet@example.test');
        app(WalletService::class)->credit($service->client, 10_750_000, 'wallet_topup');

        $this->runAutoRenewalPipeline();

        $invoice = Invoice::where('hosting_service_id', $service->id)->whereNull('order_id')->firstOrFail();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame(10_750_000, $invoice->wallet_amount_applied_kobo);

        $wallet = Wallet::where('client_id', $service->client_id)->firstOrFail();
        $this->assertSame(0, $wallet->balance_kobo);

        $service->refresh();
        $this->assertTrue($service->renews_at->greaterThan(now()->addMonths(11)));

        Notification::assertSentTo($service->client->user, NaiTalkAutoRenewalSuccess::class, fn ($n) => $n->method === 'wallet');
    }

    public function test_auto_renewal_uses_enabled_saved_card_when_wallet_is_empty(): void
    {
        Notification::fake();
        $this->seed();

        $service = $this->createActiveServiceDueForRenewal('renewal-card@example.test');
        $card = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($service->client, 'paystack', [
            'authorization' => ['authorization_code' => 'AUTH_renewal_card', 'reusable' => true, 'last4' => '4242'],
        ]);
        $card->forceFill(['use_for_auto_renewal' => true])->save();

        Http::fake([
            'api.paystack.co/transaction/charge_authorization' => Http::response([
                'status' => true,
                'data' => ['status' => 'success', 'amount' => 10_750_000, 'currency' => 'NGN', 'reference' => 'auto-ref'],
            ], 200),
        ]);

        $this->runAutoRenewalPipeline();

        $invoice = Invoice::where('hosting_service_id', $service->id)->whereNull('order_id')->firstOrFail();
        $this->assertSame('paid', $invoice->status);

        Notification::assertSentTo($service->client->user, NaiTalkAutoRenewalSuccess::class, fn ($n) => $n->method === 'card');
    }

    public function test_auto_renewal_does_not_charge_a_disabled_card_and_sends_a_reminder_instead(): void
    {
        Notification::fake();
        $this->seed();

        $service = $this->createActiveServiceDueForRenewal('renewal-disabled-card@example.test');
        $card = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($service->client, 'paystack', [
            'authorization' => ['authorization_code' => 'AUTH_disabled_card', 'reusable' => true, 'last4' => '9999'],
        ]);
        // Not enabled for auto-renewal — must never be charged.
        $card->forceFill(['use_for_auto_renewal' => false])->save();

        $this->runAutoRenewalPipeline();

        $invoice = Invoice::where('hosting_service_id', $service->id)->whereNull('order_id')->firstOrFail();
        $this->assertNotSame('paid', $invoice->status);

        // The disabled card must never be charged — no charge_authorization
        // request should have been made for it.
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'charge_authorization'));
        Notification::assertSentTo($service->client->user, NaiTalkRenewalPaymentReminder::class);

        $this->assertDatabaseHas('audit_logs', [
            'hosting_service_id' => $service->id,
            'action' => 'auto_renewal_failed',
        ]);
    }

    public function test_auto_renewal_splits_between_wallet_and_enabled_card_when_wallet_is_insufficient(): void
    {
        Notification::fake();
        $this->seed();

        $service = $this->createActiveServiceDueForRenewal('renewal-split@example.test');
        app(WalletService::class)->credit($service->client, 4_000_000, 'wallet_topup');

        $card = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($service->client, 'paystack', [
            'authorization' => ['authorization_code' => 'AUTH_split_card', 'reusable' => true, 'last4' => '1010'],
        ]);
        $card->forceFill(['use_for_auto_renewal' => true])->save();

        Http::fake([
            'api.paystack.co/transaction/charge_authorization' => Http::response([
                'status' => true,
                'data' => ['status' => 'success', 'amount' => 6_750_000, 'currency' => 'NGN', 'reference' => 'auto-split-ref'],
            ], 200),
        ]);

        $this->runAutoRenewalPipeline();

        $invoice = Invoice::where('hosting_service_id', $service->id)->whereNull('order_id')->firstOrFail();
        $this->assertSame('paid', $invoice->status);
        $this->assertSame(4_000_000, $invoice->wallet_amount_applied_kobo);

        $wallet = Wallet::where('client_id', $service->client_id)->firstOrFail();
        $this->assertSame(0, $wallet->balance_kobo);

        Notification::assertSentTo($service->client->user, NaiTalkAutoRenewalSuccess::class, fn ($n) => $n->method === 'wallet_and_card');
    }
}
