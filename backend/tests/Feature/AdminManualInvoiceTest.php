<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Notifications\NaiTalkPaymentReceived;
use App\Notifications\NaiTalkWalletPaymentConfirmation;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminManualInvoiceTest extends TestCase
{
    use RefreshDatabase;

    private function makeClient(bool $verified = true): Client
    {
        $user = User::factory()->create(['email_verified_at' => $verified ? now() : null]);

        return Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);
    }

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'super_admin']), [], 'sanctum');
    }

    public function test_admin_can_create_a_manual_invoice_for_a_client(): void
    {
        Notification::fake();
        $this->actingAsAdmin();
        $client = $this->makeClient();

        $response = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [
                ['description' => 'Custom project fee', 'quantity' => 1, 'unit_price_kobo' => 10_000_00],
            ],
            'due_at' => now()->addDays(14)->toDateString(),
            'notes' => 'Agreed one-off project fee.',
        ])->assertCreated();

        $invoiceNumber = $response->json('data.invoice_number');
        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();

        $this->assertSame($client->id, $invoice->client_id);
        $this->assertNull($invoice->order_id);
        $this->assertNull($invoice->hosting_service_id);
        $this->assertSame('unpaid', $invoice->status);
        $this->assertSame(10_000_00, $invoice->subtotal_kobo);
        // No VAT unless the admin explicitly opts in via apply_vat.
        $this->assertSame(0, $invoice->tax_kobo);
        $this->assertSame(0.0, $invoice->vat_rate);
        $this->assertSame($invoice->subtotal_kobo, $invoice->total_kobo);
        $this->assertSame($invoice->total_kobo, $invoice->outstanding_amount_kobo);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'manual_invoice_created',
            'client_id' => $client->id,
            'invoice_id' => $invoice->id,
            'reason' => 'Agreed one-off project fee.',
        ]);

        Notification::assertSentTo($client->user, NaiTalkInvoiceCreated::class);
    }

    public function test_admin_can_opt_in_to_vat_on_a_manual_invoice(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();

        $response = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [
                ['description' => 'Custom project fee', 'quantity' => 1, 'unit_price_kobo' => 10_000_00],
            ],
            'due_at' => now()->addDays(14)->toDateString(),
            'apply_vat' => true,
        ])->assertCreated();

        $invoice = Invoice::where('invoice_number', $response->json('data.invoice_number'))->firstOrFail();

        $this->assertSame((int) round(10_000_00 * 0.075), $invoice->tax_kobo);
        $this->assertSame($invoice->subtotal_kobo + $invoice->tax_kobo, $invoice->total_kobo);
    }

    public function test_manual_invoice_notification_never_throws_for_an_order_less_invoice(): void
    {
        // Regression guard for the null-order crash found during research —
        // run without Notification::fake() so toMail() actually executes.
        config(['mail.default' => 'array']);
        $this->actingAsAdmin();
        $client = $this->makeClient();

        $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'Consulting', 'quantity' => 2, 'unit_price_kobo' => 500_00]],
            'due_at' => now()->addDays(7)->toDateString(),
        ])->assertCreated();
    }

    public function test_non_admin_cannot_create_a_manual_invoice(): void
    {
        $client = $this->makeClient();
        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'x', 'quantity' => 1, 'unit_price_kobo' => 100]],
            'due_at' => now()->addDays(7)->toDateString(),
        ])->assertStatus(403);
    }

    public function test_a_manual_invoice_can_be_paid_via_wallet_and_reaches_paid_status(): void
    {
        Notification::fake();
        $this->actingAsAdmin();
        $client = $this->makeClient();

        $created = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'Project fee', 'quantity' => 1, 'unit_price_kobo' => 10_000_00]],
            'due_at' => now()->addDays(14)->toDateString(),
        ])->assertCreated();

        $invoiceNumber = $created->json('data.invoice_number');
        $invoice = Invoice::where('invoice_number', $invoiceNumber)->firstOrFail();

        app(WalletService::class)->credit($client, $invoice->total_kobo, 'wallet_topup');

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/wallet")->assertOk();

        $this->assertSame('paid', $invoice->fresh()->status);
        // Wallet-sourced payments get their own confirmation notification
        // (distinct from NaiTalkPaymentReceived, which is for gateway/bank-
        // transfer payments) — see ReconcileInvoicePaymentService::notify().
        Notification::assertSentTo($client->user, NaiTalkWalletPaymentConfirmation::class);
    }

    public function test_admin_mark_paid_still_works_unchanged_for_a_manual_invoice(): void
    {
        Notification::fake();
        $this->actingAsAdmin();
        $client = $this->makeClient();

        $created = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'Cash-paid project fee', 'quantity' => 1, 'unit_price_kobo' => 5_000_00]],
            'due_at' => now()->addDays(14)->toDateString(),
        ])->assertCreated();

        $invoiceNumber = $created->json('data.invoice_number');

        $this->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid")->assertOk();

        $this->assertSame('paid', Invoice::where('invoice_number', $invoiceNumber)->firstOrFail()->status);
        Notification::assertSentTo($client->user, NaiTalkPaymentReceived::class);
    }

    public function test_client_can_view_and_download_their_own_manual_invoice_by_number(): void
    {
        Notification::fake();
        $this->actingAsAdmin();
        $client = $this->makeClient();

        $created = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'Design retainer', 'quantity' => 1, 'unit_price_kobo' => 20_000_00]],
            'due_at' => now()->addDays(14)->toDateString(),
        ])->assertCreated();

        $invoiceNumber = $created->json('data.invoice_number');

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->getJson("/api/v1/client/invoices/{$invoiceNumber}")
            ->assertOk()
            ->assertJsonPath('invoice_number', $invoiceNumber)
            ->assertJsonPath('order_number', null);

        $this->get("/api/v1/client/invoices/{$invoiceNumber}/download")->assertOk();
    }

    public function test_a_client_cannot_view_another_clients_manual_invoice(): void
    {
        $this->actingAsAdmin();
        $client = $this->makeClient();
        $otherClient = $this->makeClient();

        $created = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'x', 'quantity' => 1, 'unit_price_kobo' => 100]],
            'due_at' => now()->addDays(7)->toDateString(),
        ])->assertCreated();

        $invoiceNumber = $created->json('data.invoice_number');

        Sanctum::actingAs($otherClient->user, [], 'sanctum');

        $this->getJson("/api/v1/client/invoices/{$invoiceNumber}")->assertStatus(404);
    }

    public function test_a_manual_invoice_appears_in_the_clients_dashboard_invoice_list(): void
    {
        Notification::fake();
        $this->actingAsAdmin();
        $client = $this->makeClient();

        $created = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'Bespoke project fee', 'quantity' => 1, 'unit_price_kobo' => 15_000_00]],
            'due_at' => now()->addDays(14)->toDateString(),
        ])->assertCreated();

        $invoiceNumber = $created->json('data.invoice_number');

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->getJson('/api/v1/client/dashboard')
            ->assertOk()
            ->assertJsonFragment(['invoice_number' => $invoiceNumber]);
    }

    public function test_admin_can_search_clients_by_name_email_or_client_code_when_picking_who_to_invoice(): void
    {
        $this->actingAsAdmin();

        $target = Client::query()->create([
            'user_id' => User::factory()->create(['name' => 'Ada Lovelace', 'email' => 'ada@example.test'])->id,
            'client_code' => 'CLT-ADA-1',
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => 'ada@example.test',
        ]);

        Client::query()->create([
            'user_id' => User::factory()->create(['name' => 'Someone Else', 'email' => 'someone-else@example.test'])->id,
            'client_code' => 'CLT-OTHER-1',
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => 'someone-else@example.test',
        ]);

        $byName = $this->getJson('/api/v1/admin/clients?search=Lovelace')->assertOk()->json('data');
        $this->assertCount(1, $byName);
        $this->assertSame($target->id, $byName[0]['id']);

        $byEmail = $this->getJson('/api/v1/admin/clients?search=ada@example.test')->assertOk()->json('data');
        $this->assertCount(1, $byEmail);
        $this->assertSame($target->id, $byEmail[0]['id']);

        $byCode = $this->getJson('/api/v1/admin/clients?search=CLT-ADA')->assertOk()->json('data');
        $this->assertCount(1, $byCode);
        $this->assertSame($target->id, $byCode[0]['id']);
    }
}
