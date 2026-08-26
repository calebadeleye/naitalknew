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
use Illuminate\Validation\ValidationException;

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
    public function __construct(private readonly VatCalculator $vatCalculator = new VatCalculator) {}

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
            'apply_vat' => ['sometimes', 'boolean'],
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
        // Manual invoices don't apply VAT unless the admin explicitly opts in
        // — unlike checkout/renewal totals (always taxable), a one-off manual
        // charge might already be VAT-inclusive, non-taxable, or agreed as a
        // flat figure with the client.
        $vatRate = ($payload['apply_vat'] ?? false) ? null : 0.0;
        $breakdown = $this->vatCalculator->calculate($subtotalKobo, (int) ($payload['discount_kobo'] ?? 0), $vatRate);

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

    /**
     * Lets an admin fix a mistake (wrong line item, discount, due date) on
     * an invoice — but only while its reconciliation_status is still
     * 'pending'. Once a payment has reconciled against it (status becomes
     * 'reconciled' or 'mismatch'), the figures are locked: editing them
     * afterwards would desync the invoice from money already applied to it.
     * Note reconciliation_status also reverts to 'pending' after a partial
     * (underpayment) payment — see ReconcileInvoicePaymentService — so an
     * invoice can already have amount_paid_kobo > 0 here; the new total is
     * guarded against being edited below that.
     */
    public function update(Request $request, Invoice $invoice)
    {
        if ($invoice->reconciliation_status !== 'pending') {
            abort(422, 'Only invoices with a pending reconciliation status can be edited.');
        }

        $payload = $request->validate([
            'line_items' => ['required', 'array', 'min:1'],
            'line_items.*.description' => ['required', 'string', 'max:255'],
            'line_items.*.quantity' => ['required', 'integer', 'min:1'],
            'line_items.*.unit_price_kobo' => ['required', 'integer', 'min:0'],
            'due_at' => ['required', 'date'],
            'discount_kobo' => ['nullable', 'integer', 'min:0'],
            'apply_vat' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $lineItems = collect($payload['line_items'])->map(fn (array $item) => [
            'description' => $item['description'],
            'quantity' => $item['quantity'],
            'unit_price_kobo' => $item['unit_price_kobo'],
            'total_kobo' => $item['quantity'] * $item['unit_price_kobo'],
        ])->all();

        $subtotalKobo = array_sum(array_column($lineItems, 'total_kobo'));
        $vatRate = ($payload['apply_vat'] ?? false) ? null : 0.0;
        $breakdown = $this->vatCalculator->calculate($subtotalKobo, (int) ($payload['discount_kobo'] ?? 0), $vatRate);

        if ((int) $invoice->amount_paid_kobo > $breakdown['total_kobo']) {
            throw ValidationException::withMessages([
                'line_items' => ['This invoice already has '.number_format($invoice->amount_paid_kobo / 100, 2).' paid against it — the new total cannot be less than that.'],
            ]);
        }

        $before = $invoice->only(['line_items', 'subtotal_kobo', 'discount_kobo', 'tax_kobo', 'vat_rate', 'total_kobo', 'outstanding_amount_kobo', 'due_at']);

        $invoice->forceFill([
            'subtotal_kobo' => $breakdown['subtotal_kobo'],
            'discount_kobo' => $breakdown['discount_kobo'],
            'tax_kobo' => $breakdown['vat_amount_kobo'],
            'vat_rate' => $breakdown['vat_rate'],
            'total_kobo' => $breakdown['total_kobo'],
            'outstanding_amount_kobo' => max($breakdown['total_kobo'] - (int) $invoice->amount_paid_kobo, 0),
            'due_at' => $payload['due_at'],
            'line_items' => $lineItems,
        ])->save();

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'client_id' => $invoice->client_id,
            'invoice_id' => $invoice->id,
            'action' => 'invoice_updated',
            'reason' => $payload['notes'] ?? null,
            'before_state' => $before,
            'after_state' => $invoice->only(['line_items', 'subtotal_kobo', 'discount_kobo', 'tax_kobo', 'vat_rate', 'total_kobo', 'outstanding_amount_kobo', 'due_at']),
            'source' => 'admin',
            'notify_client' => false,
        ]);

        return response()->json(['data' => $invoice->fresh()]);
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
