<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\ServiceOffering;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Ordering a service on its own — the SSL certificate (₦15,000, added by migration). */
class ServiceOrderTest extends TestCase
{
    use RefreshDatabase;

    private function makeClient(): Client
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'role' => 'client']);

        return Client::query()->create(['user_id' => $user->id, 'client_code' => 'CL-'.$user->id, 'account_type' => 'registered_user', 'client_status' => 'active', 'billing_email' => $user->email]);
    }

    public function test_the_ssl_certificate_is_on_sale_publicly_and_in_the_client_catalog(): void
    {
        $this->getJson('/api/v1/public/service-offerings/ssl-certificate')->assertOk()
            ->assertJsonPath('name', 'SSL Certificate')
            ->assertJsonPath('price_kobo', 1500000)
            ->assertJsonPath('requires_domain', true);
        $this->assertStringContainsString('our team will reach out', ServiceOffering::where('slug', 'ssl-certificate')->value('short_description'));

        // Offerings not switched on for online ordering stay off the public endpoint.
        ServiceOffering::query()->create(['name' => 'Website build', 'slug' => 'build', 'category' => 'web_development', 'short_description' => 'x', 'price_kobo' => 100, 'billing_type' => 'one_time', 'is_active' => true, 'sort_order' => 1]);
        $this->getJson('/api/v1/public/service-offerings/build')->assertNotFound();

        Sanctum::actingAs($this->makeClient()->user, [], 'sanctum');
        $ssl = collect($this->getJson('/api/v1/client/services/catalog')->assertOk()->json('data'))->firstWhere('slug', 'ssl-certificate');
        $this->assertSame('/client/order/service?offering=ssl-certificate', $ssl['order_route']);
    }

    public function test_ordering_creates_an_invoice_and_paying_it_opens_a_setup_ticket_once(): void
    {
        Notification::fake();
        $client = $this->makeClient();
        $admin = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->postJson('/api/v1/client/orders/service', ['offering' => 'ssl-certificate', 'terms_accepted' => true])
            ->assertStatus(422)->assertJsonValidationErrors('domain');

        $created = $this->postJson('/api/v1/client/orders/service', ['offering' => 'ssl-certificate', 'domain' => 'https://Shop.example.com/', 'notes' => 'Site is on WordPress', 'terms_accepted' => true])->assertCreated();

        $invoice = Invoice::where('invoice_number', $created->json('invoice.invoice_number'))->firstOrFail();
        $this->assertSame(1500000, $invoice->subtotal_kobo);
        $this->assertSame('SSL Certificate — shop.example.com (1 year)', $invoice->line_items[0]['description']);
        Notification::assertSentTo($client->user, NaiTalkInvoiceCreated::class);
        $this->assertSame(0, SupportTicket::count(), 'no ticket before payment');

        app(WalletService::class)->credit($client, $invoice->total_kobo, 'wallet_topup');
        $this->postJson("/api/v1/client/invoices/{$invoice->invoice_number}/pay/wallet")->assertOk();

        $this->assertSame('paid', $invoice->fresh()->status);
        $ticket = SupportTicket::query()->firstOrFail();
        $this->assertSame('SSL Certificate setup — shop.example.com', $ticket->subject);
        $this->assertSame($client->id, $ticket->client_id);
        $this->assertSame($ticket->ticket_number, Order::firstOrFail()->metadata['setup_ticket']);

        // Running the paid hook again doesn't open a second ticket.
        app(\App\Services\Billing\ServiceOrderService::class)->handlePaid($invoice->fresh());
        $this->assertSame(1, SupportTicket::count());
    }

    public function test_an_offering_not_sold_online_cannot_be_ordered(): void
    {
        ServiceOffering::query()->create(['name' => 'Website build', 'slug' => 'build', 'category' => 'web_development', 'short_description' => 'x', 'price_kobo' => 100, 'billing_type' => 'one_time', 'is_active' => true, 'sort_order' => 1]);
        Sanctum::actingAs($this->makeClient()->user, [], 'sanctum');

        $this->postJson('/api/v1/client/orders/service', ['offering' => 'build', 'terms_accepted' => true])->assertNotFound();
    }
}
