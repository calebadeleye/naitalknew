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

    public function test_domain_is_registered_before_hosting_is_provisioned_after_payment(): void
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

        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        $domain = Domain::where('domain_name', 'liveonnaitalk.com')->firstOrFail();
        $this->assertSame('registered', $domain->registration_status);

        $service = HostingService::where('id', $checkout->json('service.id'))->firstOrFail();
        $this->assertSame('provisioned', $service->provisioning_status);
        $this->assertSame($service->id, $domain->fresh()->linked_hosting_service_id);
    }

    public function test_hosting_is_never_provisioned_if_domain_registration_fails(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('domain-hosting-fail@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'racecondition.com');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'racecondition.com',
            'terms_accepted' => true,
            'register_domain' => true,
        ])->assertCreated();

        // Simulate the domain becoming unavailable to someone else between
        // checkout and registration — the dry-run availability heuristic
        // treats any domain name containing "taken" as unavailable.
        Domain::where('domain_name', 'racecondition.com')->update(['domain_name' => 'racecondition-taken.com']);

        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        $domain = Domain::where('domain_name', 'racecondition-taken.com')->firstOrFail();
        $this->assertSame('registration_failed', $domain->registration_status);

        // Payment reconciliation always flips a paid order's hosting service to
        // "awaiting_provisioning" first; the important guarantee is that it
        // never advances past that to "provisioned" when domain registration failed.
        $service = HostingService::where('id', $checkout->json('service.id'))->firstOrFail();
        $this->assertNotSame('provisioned', $service->provisioning_status);
        $this->assertSame('awaiting_provisioning', $service->provisioning_status);
    }
}
