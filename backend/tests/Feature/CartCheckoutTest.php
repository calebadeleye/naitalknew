<?php

namespace Tests\Feature;

use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\SupportTicket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/** The shopping cart: several things, one order and one invoice. */
class CartCheckoutTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
        $this->seed();
        $this->activateDomainPricing('.com');
    }

    /** A hosting plan for a domain they own, a new domain, and an SSL certificate. */
    private function mixedCart(): array
    {
        return [
            ['type' => 'hosting', 'plan_slug' => 'business-website-care', 'primary_domain' => 'https://www.MyShop.com/'],
            ['type' => 'domain', 'domain_name' => 'brandnewname.com'],
            ['type' => 'service', 'offering' => 'ssl-certificate', 'domain' => 'myshop.com', 'notes' => 'WordPress'],
        ];
    }

    public function test_the_cart_is_priced_by_the_server_with_one_vat_on_the_whole(): void
    {
        ['token' => $token] = $this->registerVerifiedDomainClient('cart-quote@example.test');

        $quote = $this->withToken($token)->postJson('/api/v1/client/cart/quote', ['lines' => $this->mixedCart()])->assertOk();

        // Hosting ₦60,000 + domain ₦23,000 + SSL ₦15,000 = ₦98,000; VAT 7.5% = ₦7,350.
        $this->assertSame(9_800_000, $quote->json('subtotal_kobo'));
        $this->assertSame(735_000, $quote->json('vat_kobo'));
        $this->assertSame(10_535_000, $quote->json('total_kobo'));
        $this->assertFalse($quote->json('has_errors'));
        $this->assertSame(['Business Website Care Hosting', 'Domain Registration', 'SSL Certificate'], collect($quote->json('lines'))->pluck('title')->all());
        $this->assertSame('myshop.com', $quote->json('lines.0.subtitle'), 'a pasted address is tidied to the bare domain');

        $this->withToken($token)->postJson('/api/v1/client/cart/quote', ['lines' => []])->assertOk()->assertJsonPath('total_kobo', 0);
    }

    public function test_a_line_that_cannot_be_ordered_is_flagged_not_hidden(): void
    {
        ['token' => $token] = $this->registerVerifiedDomainClient('cart-errors@example.test');

        $quote = $this->withToken($token)->postJson('/api/v1/client/cart/quote', ['lines' => [
            ['type' => 'hosting', 'plan_slug' => 'no-such-plan', 'primary_domain' => 'a.com'],
            ['type' => 'domain', 'domain_name' => 'dup.com'],
            ['type' => 'hosting', 'plan_slug' => 'business-website-care', 'primary_domain' => 'dup.com'],
            ['type' => 'service', 'offering' => 'ssl-certificate'],
        ]])->assertOk();

        $this->assertTrue($quote->json('has_errors'));
        $this->assertSame('This hosting plan is no longer available.', $quote->json('lines.0.error'));
        $this->assertSame('dup.com is in your cart more than once.', $quote->json('lines.2.error'));
        $this->assertSame('Enter the website address this is for.', $quote->json('lines.3.error'));
        $this->assertArrayNotHasKey('error', $quote->json('lines.1'));
    }

    public function test_the_shape_of_the_cart_is_validated(): void
    {
        ['token' => $token] = $this->registerVerifiedDomainClient('cart-shape@example.test');

        $this->withToken($token)->postJson('/api/v1/client/cart/quote', ['lines' => [['type' => 'hosting', 'primary_domain' => 'a.com']]])
            ->assertStatus(422)->assertJsonValidationErrors('lines.0.plan_slug');
        $this->withToken($token)->postJson('/api/v1/client/cart/quote', ['lines' => [['type' => 'gift-card']]])
            ->assertStatus(422)->assertJsonValidationErrors('lines.0.type');
        $this->withToken($token)->postJson('/api/v1/client/cart/quote', ['lines' => array_fill(0, 11, ['type' => 'domain', 'domain_name' => 'x.com'])])
            ->assertStatus(422)->assertJsonValidationErrors('lines');
    }

    public function test_checkout_makes_one_order_and_one_invoice_and_paying_it_sets_everything_in_motion(): void
    {
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('cart-checkout@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'brandnewname.com');

        $orders = Order::count();
        $invoices = Invoice::count();
        $this->withToken($token)->postJson('/api/v1/client/orders/cart', ['lines' => $this->mixedCart()])->assertStatus(422)->assertJsonValidationErrors('terms_accepted');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/cart', ['lines' => $this->mixedCart(), 'terms_accepted' => true])->assertCreated();

        $this->assertSame(10_535_000, $checkout->json('invoice.total_kobo'));
        $this->assertSame($orders + 1, Order::count());
        $this->assertSame($invoices + 1, Invoice::count());
        $descriptions = collect($checkout->json('invoice.line_items'))->pluck('description')->all();
        $this->assertSame(['Business Website Care Hosting — myshop.com', 'Domain Registration — brandnewname.com', 'SSL Certificate — myshop.com (1 year)'], $descriptions);

        $service = HostingService::where('primary_domain', 'myshop.com')->firstOrFail();
        $this->assertSame('pending_payment', $service->status);
        $this->assertSame($service->id, Invoice::latest('id')->first()->hosting_service_id, 'a single website is shown on the invoice');
        $this->assertDatabaseHas('domain_orders', ['domain_name' => 'brandnewname.com', 'hosting_service_id' => null, 'status' => 'pending_payment']);
        $tickets = SupportTicket::count();

        // Pay the one invoice: website queued, domain flagged for registration, SSL ticket opened.
        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $this->withToken($this->domainAdminToken())->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])->assertOk();

        $this->assertNotSame('pending_payment', $service->fresh()->status);
        $this->assertSame('awaiting_manual_registration', DomainOrder::where('domain_name', 'brandnewname.com')->value('status'));
        $this->assertSame($tickets + 1, SupportTicket::count(), 'one setup ticket, not one per payment step');
        $this->assertSame('SSL Certificate setup — myshop.com', SupportTicket::latest('id')->firstOrFail()->subject);
        $this->assertCount(1, Order::latest('id')->first()->metadata['setup_tickets']);
    }

    public function test_two_websites_with_a_new_domain_each_become_two_services_on_one_invoice(): void
    {
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('cart-two@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'firstnew.com');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/cart', ['terms_accepted' => true, 'lines' => [
            ['type' => 'hosting', 'plan_slug' => 'business-website-care', 'primary_domain' => 'firstnew.com', 'register_domain' => true],
            ['type' => 'hosting', 'plan_slug' => 'starter-website-care', 'primary_domain' => 'second-owned.com'],
        ]])->assertCreated();

        $this->assertSame(2, HostingService::where('order_id', Order::latest('id')->value('id'))->count());
        $this->assertNull(Invoice::latest('id')->first()->hosting_service_id);
        $first = HostingService::where('primary_domain', 'firstnew.com')->firstOrFail();
        $this->assertSame($first->id, DomainOrder::where('domain_name', 'firstnew.com')->value('hosting_service_id'));
        $this->assertSame($first->id, Domain::where('domain_name', 'firstnew.com')->value('linked_hosting_service_id'));
        // A domain they already own elsewhere is tracked, never registered.
        $this->assertDatabaseHas('domains', ['domain_name' => 'second-owned.com', 'source' => 'external']);
        $this->assertDatabaseMissing('domain_orders', ['domain_name' => 'second-owned.com']);

        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $this->withToken($this->domainAdminToken())->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])->assertOk();

        // The owned-domain site is queued straight away; the new-domain site waits for its registration.
        $this->assertNotSame('pending_payment', HostingService::where('primary_domain', 'second-owned.com')->value('status'));
        $this->assertSame('awaiting_manual_registration', DomainOrder::where('domain_name', 'firstnew.com')->value('status'));
    }

    public function test_a_domain_that_was_taken_while_it_sat_in_the_cart_stops_checkout(): void
    {
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('cart-taken@example.test');
        $this->completeDomainContact($client);

        // Never searched, so the live check runs — and "taken" names are unavailable.
        $this->withToken($token)->postJson('/api/v1/client/orders/cart', ['terms_accepted' => true, 'lines' => [['type' => 'domain', 'domain_name' => 'already-taken.com']]])
            ->assertStatus(422)->assertJsonValidationErrors('lines');

        $this->assertSame(0, Order::where('metadata->kind', 'cart')->count());
    }

    public function test_a_cart_with_a_bad_line_creates_nothing(): void
    {
        ['token' => $token] = $this->registerVerifiedDomainClient('cart-bad@example.test');
        $orders = Order::count();
        $invoices = Invoice::count();

        $this->withToken($token)->postJson('/api/v1/client/orders/cart', ['terms_accepted' => true, 'lines' => [
            ['type' => 'service', 'offering' => 'ssl-certificate', 'domain' => 'ok.com'],
            ['type' => 'hosting', 'plan_slug' => 'no-such-plan', 'primary_domain' => 'b.com'],
        ]])->assertStatus(422);

        $this->assertSame($orders, Order::count());
        $this->assertSame($invoices, Invoice::count());
    }
}
