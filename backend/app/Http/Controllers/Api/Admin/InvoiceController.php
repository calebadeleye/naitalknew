<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Client;
use App\Models\Invoice;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Services\Billing\VatCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Admin-created invoices not tied to any hosting/domain order — e.g. a
 * bespoke project fee, a one-off charge, or anything else billed outside
 * the normal checkout/renewal flows. Once created, the invoice behaves
 * exactly like any other: it's payable through every existing client
 * payment method (all already invoice-number-scoped, not order-scoped) and
 * can be marked paid manually via the existing
 * Admin\InvoicePaymentController::markPaid.
 */
class InvoiceController extends Controller
{
    public function __construct(private readonly VatCalculator $vatCalculator = new VatCalculator)
    {
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'line_items' => ['required', 'array', 'min:1'],
            'line_items.*.description' => ['required', 'string', 'max:255'],
            'line_items.*.quantity' => ['required', 'integer', 'min:1'],
            'line_items.*.unit_price_kobo' => ['required', 'integer', 'min:0'],
            'due_at' => ['required', 'date'],
            'discount_kobo' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $client = Client::query()->findOrFail($payload['client_id']);

        $lineItems = collect($payload['line_items'])->map(fn (array $item) => [
            'description' => $item['description'],
            'quantity' => $item['quantity'],
            'unit_price_kobo' => $item['unit_price_kobo'],
            'total_kobo' => $item['quantity'] * $item['unit_price_kobo'],
        ])->all();

        $subtotalKobo = array_sum(array_column($lineItems, 'total_kobo'));
        $breakdown = $this->vatCalculator->calculate($subtotalKobo, (int) ($payload['discount_kobo'] ?? 0));

        $invoice = Invoice::query()->create([
            'client_id' => $client->id,
            'order_id' => null,
            'hosting_service_id' => null,
            'invoice_number' => $this->number('INV'),
            'status' => 'unpaid',
            'reconciliation_status' => 'pending',
            'subtotal_kobo' => $breakdown['subtotal_kobo'],
            'discount_kobo' => $breakdown['discount_kobo'],
            'tax_kobo' => $breakdown['vat_amount_kobo'],
            'vat_rate' => $breakdown['vat_rate'],
            'total_kobo' => $breakdown['total_kobo'],
            'outstanding_amount_kobo' => $breakdown['total_kobo'],
            'issued_at' => now()->toDateString(),
            'due_at' => $payload['due_at'],
            'line_items' => $lineItems,
        ]);

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $client->id,
            'invoice_id' => $invoice->id,
            'action' => 'manual_invoice_created',
            'reason' => $payload['notes'] ?? null,
            'source' => 'admin',
            'notify_client' => true,
        ]);

        $client->loadMissing('user');
        $client->user?->notify(new NaiTalkInvoiceCreated($invoice));

        return response()->json(['data' => $invoice->fresh()], 201);
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
