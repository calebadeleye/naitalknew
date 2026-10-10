<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Wallet\WalletService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class ClientPaymentReceiptTest extends TestCase
{
    use RefreshDatabase;

    private function makeClient(): Client
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        return Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);
    }

    private function createInvoice(Client $client, int $unitPriceKobo = 10_000_00): string
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'super_admin']), [], 'sanctum');

        $invoiceNumber = $this->postJson('/api/v1/admin/invoices', [
            'client_id' => $client->id,
            'line_items' => [['description' => 'Project fee', 'quantity' => 1, 'unit_price_kobo' => $unitPriceKobo]],
            'due_at' => now()->addDays(14)->toDateString(),
        ])->assertCreated()->json('data.invoice_number');

        $this->app['auth']->forgetGuards();

        return $invoiceNumber;
    }

    private function payFromWallet(Client $client, string $invoiceNumber, int $walletKobo): void
    {
        app(WalletService::class)->credit($client, $walletKobo, 'wallet_topup');
        Sanctum::actingAs($client->user, [], 'sanctum');
        $this->postJson("/api/v1/client/invoices/{$invoiceNumber}/pay/wallet")->assertOk();
    }

    public function test_no_receipt_is_offered_or_served_before_anything_is_paid(): void
    {
        Notification::fake();
        $client = $this->makeClient();
        $invoiceNumber = $this->createInvoice($client);

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->getJson("/api/v1/client/invoices/{$invoiceNumber}")->assertOk()->assertJsonPath('receipt_available', false);
        $this->get("/api/v1/client/invoices/{$invoiceNumber}/receipt")->assertNotFound();
    }

    public function test_a_client_can_download_a_receipt_once_an_invoice_is_paid(): void
    {
        Notification::fake();
        $client = $this->makeClient();
        $invoiceNumber = $this->createInvoice($client);
        $this->payFromWallet($client, $invoiceNumber, Invoice::where('invoice_number', $invoiceNumber)->value('total_kobo'));

        $this->getJson("/api/v1/client/invoices/{$invoiceNumber}")->assertOk()->assertJsonPath('receipt_available', true);

        $response = $this->get("/api/v1/client/invoices/{$invoiceNumber}/receipt")->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString("receipt-{$invoiceNumber}.pdf", (string) $response->headers->get('Content-Disposition'));
    }

    public function test_the_receipt_lists_the_payments_and_flags_a_part_payment(): void
    {
        Notification::fake();
        $client = $this->makeClient();
        $invoiceNumber = $this->createInvoice($client, 10_000_00);
        $total = (int) Invoice::where('invoice_number', $invoiceNumber)->value('total_kobo');
        $this->payFromWallet($client, $invoiceNumber, intdiv($total, 2));

        $captured = null;
        $pdf = Mockery::mock(\Barryvdh\DomPDF\PDF::class);
        $pdf->shouldReceive('download')->andReturn(response('pdf'));
        Pdf::shouldReceive('loadView')->once()->andReturnUsing(function (string $view, array $data) use (&$captured, $pdf) {
            $captured = [$view, $data['receipt']];

            return $pdf;
        });

        $this->get("/api/v1/client/invoices/{$invoiceNumber}/receipt")->assertOk();

        [$view, $receipt] = $captured;
        $this->assertSame('invoices.receipt', $view);
        $this->assertSame("RCT-{$invoiceNumber}", $receipt['receipt_number']);
        $this->assertFalse($receipt['paid_in_full']);
        $this->assertCount(1, $receipt['payments']);
        $this->assertSame('NAI TALK wallet', $receipt['payments'][0]['method']);
    }

    public function test_an_invoice_marked_paid_by_an_admin_still_gets_a_receipt(): void
    {
        Notification::fake();
        $client = $this->makeClient();
        $invoiceNumber = $this->createInvoice($client);

        Sanctum::actingAs(User::factory()->create(['role' => 'super_admin']), [], 'sanctum');
        $this->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid")->assertOk();
        $this->app['auth']->forgetGuards();

        Sanctum::actingAs($client->user, [], 'sanctum');
        $this->get("/api/v1/client/invoices/{$invoiceNumber}/receipt")->assertOk();
    }

    public function test_a_client_cannot_download_another_clients_receipt(): void
    {
        Notification::fake();
        $client = $this->makeClient();
        $invoiceNumber = $this->createInvoice($client);
        $this->payFromWallet($client, $invoiceNumber, Invoice::where('invoice_number', $invoiceNumber)->value('total_kobo'));
        $this->app['auth']->forgetGuards();

        Sanctum::actingAs($this->makeClient()->user, [], 'sanctum');
        $this->get("/api/v1/client/invoices/{$invoiceNumber}/receipt")->assertNotFound();
    }
}
