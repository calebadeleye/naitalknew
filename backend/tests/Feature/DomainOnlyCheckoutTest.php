<?php

namespace Tests\Feature;

use App\Models\Domain;
use App\Models\DomainOrder;
use App\Services\Payments\ReconcileInvoicePaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class DomainOnlyCheckoutTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    public function test_domain_only_order_creates_invoice_with_domain_line_item_and_correct_vat(): void
    {
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-only@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'mynaitalkbiz.com');

        $response = $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'mynaitalkbiz.com',
        ])->assertCreated();

        // ₦23,000 subtotal, 7.5% VAT => ₦24,725 total.
        $this->assertSame(2_472_500, $response->json('invoice.total_kobo'));
        $lineItems = $response->json('invoice.line_items');
        $this->assertSame('Domain Registration — mynaitalkbiz.com', $lineItems[0]['description']);

        $this->assertDatabaseHas('domain_orders', [
            'domain_name' => 'mynaitalkbiz.com',
            'order_type' => 'registration',
            'status' => 'pending_payment',
        ]);
    }

    public function test_domain_cannot_be_ordered_without_a_recent_availability_check(): void
    {
        $this->activateDomainPricing('.com');
        ['token' => $token] = $this->registerVerifiedDomainClient('domain-unverified@example.test');

        $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'never-searched.com',
        ])->assertStatus(422);
    }

    public function test_domain_is_not_registered_until_invoice_is_fully_paid(): void
    {
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-unpaid@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'stillunpaid.com');

        $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'stillunpaid.com',
        ])->assertCreated();

        $domain = Domain::where('domain_name', 'stillunpaid.com')->firstOrFail();
        $this->assertSame('pending_payment', $domain->registration_status);
        $this->assertNotSame('registered', $domain->registration_status);
    }

    public function test_domain_order_is_marked_awaiting_manual_registration_after_full_payment(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-paid@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'nowregistered.com');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'nowregistered.com',
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        // Registration is manual now — payment confirmation never calls
        // Spaceship to register the domain, it just flags the order for an
        // admin to finish by hand.
        $domain = Domain::where('domain_name', 'nowregistered.com')->firstOrFail();
        $this->assertSame('awaiting_manual_registration', $domain->registration_status);
        $this->assertSame('pending', $domain->status);
        $this->assertNull($domain->expires_at);

        $domainOrder = DomainOrder::where('domain_id', $domain->id)->firstOrFail();
        $this->assertSame('awaiting_manual_registration', $domainOrder->status);
    }

    public function test_duplicate_reconciliation_of_the_same_paid_invoice_does_not_redispatch_the_domain_order(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-dup@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'noduplicate.com');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'noduplicate.com',
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        $domain = Domain::where('domain_name', 'noduplicate.com')->firstOrFail();
        $this->assertSame('awaiting_manual_registration', $domain->registration_status);

        // Simulate a repeated webhook/dispatcher call for the same already-paid invoice.
        $invoice = $domain->orders()->firstOrFail()->invoice;
        $payment = $invoice->payments()->firstOrFail();
        app(ReconcileInvoicePaymentService::class)->reconcile($invoice->fresh(), $payment->fresh(), $payment->amount_kobo, $payment->gateway);

        $domain->refresh();
        // The dispatcher's idempotency guard (only re-dispatch orders still
        // at pending_payment) must leave an already-flagged order alone.
        $this->assertSame('awaiting_manual_registration', $domain->registration_status);
        $domainOrder = DomainOrder::where('domain_id', $domain->id)->firstOrFail();
        $this->assertSame('awaiting_manual_registration', $domainOrder->status);
    }

    public function test_admin_can_mark_a_domain_order_as_registered(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-mark@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'markmeregistered.com');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'markmeregistered.com',
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $adminToken = $this->domainAdminToken();

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        $domainOrder = DomainOrder::where('domain_name', 'markmeregistered.com')->firstOrFail();

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/domain-orders/{$domainOrder->id}/mark-registered", [
                'expires_at' => now()->addYear()->toDateString(),
            ])
            ->assertOk();

        $domain = Domain::where('domain_name', 'markmeregistered.com')->firstOrFail();
        $this->assertSame('registered', $domain->registration_status);
        $this->assertSame('active', $domain->status);
        $this->assertNotNull($domain->registered_at);
        $this->assertNotNull($domain->expires_at);
        $this->assertSame('completed', $domainOrder->fresh()->status);
    }

    public function test_marking_a_domain_order_registered_is_rejected_when_not_awaiting_manual_registration(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-mark-reject@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'notyetpaid.com');

        $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => 'notyetpaid.com',
        ])->assertCreated();

        $domainOrder = DomainOrder::where('domain_name', 'notyetpaid.com')->firstOrFail();
        $this->assertSame('pending_payment', $domainOrder->status);

        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/domain-orders/{$domainOrder->id}/mark-registered", [
                'expires_at' => now()->addYear()->toDateString(),
            ])
            ->assertStatus(422);
    }
}
