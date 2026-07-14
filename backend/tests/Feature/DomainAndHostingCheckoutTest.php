<?php

namespace Tests\Feature;

use App\Models\Domain;
use App\Models\HostingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class DomainAndHostingCheckoutTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    public function test_domain_and_hosting_order_creates_separate_line_items_with_correct_combined_vat(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-hosting@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'newbizsite.com');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'newbizsite.com',
            'terms_accepted' => true,
            'register_domain' => true,
        ])->assertCreated();

        // Domain ₦23,000 + hosting ₦100,000 = ₦123,000 subtotal, 7.5% VAT => ₦132,225.
        $this->assertSame(13_222_500, $checkout->json('invoice.total_kobo'));

        $lineItems = collect($checkout->json('invoice.line_items'))->pluck('description');
        $this->assertTrue($lineItems->contains('Domain Registration — newbizsite.com'));
        $this->assertTrue($lineItems->contains(fn ($description) => str_contains($description, 'Hosting')));

        $this->assertDatabaseHas('domains', ['domain_name' => 'newbizsite.com', 'source' => 'spaceship_registered']);
        $this->assertDatabaseHas('domain_orders', ['domain_name' => 'newbizsite.com', 'order_type' => 'registration']);
    }

    public function test_hosting_stays_unprovisioned_until_admin_marks_the_domain_registered(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-hosting-paid@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'liveonnaitalk.com');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'liveonnaitalk.com',
            'terms_accepted' => true,
            'register_domain' => true,
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $adminToken = $this->domainAdminToken();

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        // Registration is manual now — payment alone must never provision
        // hosting for a domain that hasn't been confirmed registered yet.
        $domain = Domain::where('domain_name', 'liveonnaitalk.com')->firstOrFail();
        $this->assertSame('awaiting_manual_registration', $domain->registration_status);

        $service = HostingService::where('id', $checkout->json('service.id'))->firstOrFail();
        $this->assertSame('awaiting_provisioning', $service->provisioning_status);
        $this->assertSame($service->id, $domain->linked_hosting_service_id);

        $domainOrder = $domain->orders()->where('order_type', 'registration')->firstOrFail();

        $this->withToken($adminToken)
            ->postJson("/api/v1/admin/domain-orders/{$domainOrder->id}/mark-registered", [
                'expires_at' => now()->addYear()->toDateString(),
            ])
            ->assertOk();

        $domain->refresh();
        $this->assertSame('registered', $domain->registration_status);
        $this->assertSame('provisioned', $service->fresh()->provisioning_status);
    }
}
