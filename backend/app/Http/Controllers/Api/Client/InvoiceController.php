<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Services\Billing\InvoiceBreakdown;
use App\Services\Billing\Money;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    /**
     * Every invoice on the client's account — including standalone ones an
     * admin raised (no order), which never appear under My Orders.
     */
    public function index(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $invoices = $client->invoices()
            ->with('order:id,order_number')
            ->latest('id')
            ->get()
            ->map(fn (Invoice $invoice) => [
                'invoice_number' => $invoice->invoice_number,
                'order_number' => $invoice->order?->order_number,
                'status' => $invoice->status,
                'description' => collect($invoice->line_items ?? [])->pluck('description')->filter()->implode(', '),
                'total' => Money::naira($invoice->total_kobo),
                'amount_paid' => Money::naira($invoice->amount_paid_kobo),
                'amount_paid_kobo' => (int) $invoice->amount_paid_kobo,
                'outstanding' => Money::naira($invoice->status === 'paid' ? 0 : $invoice->payableKobo()),
                'outstanding_kobo' => $invoice->status === 'paid' ? 0 : $invoice->payableKobo(),
                'issued_at' => $invoice->issued_at?->toDateString(),
                'due_at' => $invoice->due_at?->toDateString(),
            ]);

        return response()->json(['data' => $invoices]);
    }

    public function show(Request $request, Order $order)
    {
        $invoice = $order->invoice()->latest()->first();

        abort_if(! $invoice, 404, 'No invoice found for this order.');

        return response()->json($this->buildInvoiceData($request, $invoice, $order));
    }

    public function downloadPdf(Request $request, Order $order)
    {
        $invoice = $order->invoice()->latest()->first();

        abort_if(! $invoice, 404, 'No invoice found for this order.');

        $data = $this->buildInvoiceData($request, $invoice, $order);

        $pdf = Pdf::loadView('invoices.pdf', ['invoice' => $data]);

        return $pdf->download("invoice-{$data['invoice_number']}.pdf");
    }

    public function showByNumber(Request $request, Invoice $invoice)
    {
        return response()->json($this->buildInvoiceData($request, $invoice, $invoice->order));
    }

    public function downloadByNumberPdf(Request $request, Invoice $invoice)
    {
        $data = $this->buildInvoiceData($request, $invoice, $invoice->order);

        $pdf = Pdf::loadView('invoices.pdf', ['invoice' => $data]);

        return $pdf->download("invoice-{$data['invoice_number']}.pdf");
    }

    /**
     * A payment receipt for everything received against an invoice so far —
     * offered as soon as anything has been paid, so a part payment gets one
     * too. Its total is the invoice's own amount paid (the reconciled source
     * of truth); individual payment rows are listed under it, and anything
     * recorded without one (e.g. an admin marking the invoice paid) is shown
     * as a single "recorded by" line so the two always add up.
     */
    public function downloadReceiptPdf(Request $request, Invoice $invoice)
    {
        $data = $this->buildInvoiceData($request, $invoice, $invoice->order);

        abort_if($invoice->amount_paid_kobo <= 0, 404, 'No payment has been received for this invoice yet.');

        $payments = Payment::query()
            ->where('invoice_id', $invoice->id)
            ->where('status', 'paid')
            ->orderBy('paid_at')
            ->orderBy('id')
            ->get();

        $rows = $payments->map(fn (Payment $payment) => [
            'date' => ($payment->paid_at ?? $payment->created_at)?->toDateString(),
            'method' => self::PAYMENT_METHOD_LABELS[$payment->gateway] ?? ucfirst(str_replace('_', ' ', (string) $payment->gateway)),
            'reference' => $payment->reference ?: '—',
            'amount' => Money::naira($payment->amount_kobo),
        ])->all();

        $unlistedKobo = $invoice->amount_paid_kobo - (int) $payments->sum('amount_kobo');

        if ($unlistedKobo > 0) {
            $rows[] = [
                'date' => $invoice->paid_at?->toDateString() ?? '—',
                'method' => 'Recorded by '.config('company.name', 'NAI TALK'),
                'reference' => '—',
                'amount' => Money::naira($unlistedKobo),
            ];
        }

        $receipt = [
            'receipt_number' => 'RCT-'.$invoice->invoice_number,
            'receipt_date' => ($invoice->paid_at ?? $payments->last()?->paid_at ?? now())->toDateString(),
            'invoice_number' => $invoice->invoice_number,
            'order_number' => $data['order_number'],
            'from' => $data['from'],
            'bill_to' => $data['bill_to'],
            'line_items' => $data['line_items'],
            'payments' => $rows,
            'invoice_total' => $data['total'],
            'total_received' => Money::naira($invoice->amount_paid_kobo),
            'outstanding_amount' => $data['outstanding_amount'],
            'paid_in_full' => $invoice->status === 'paid',
        ];

        return Pdf::loadView('invoices.receipt', ['receipt' => $receipt])->download("receipt-{$invoice->invoice_number}.pdf");
    }

    private const PAYMENT_METHOD_LABELS = [
        'paystack' => 'Card (Paystack)',
        'flutterwave' => 'Card (Flutterwave)',
        'bank_transfer' => 'Bank transfer',
        'wallet' => 'NAI TALK wallet',
    ];

    private function buildInvoiceData(Request $request, Invoice $invoice, ?Order $order): array
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');
        abort_if($invoice->client_id !== $client->id, 404);

        // Only a transfer still waiting to be reconciled counts: once an instalment
        // has been applied its row is 'paid' history, and reporting that status
        // made the page show an upload form the API then refused.
        $bankTransferPayment = Payment::query()->where('invoice_id', $invoice->id)->where('gateway', 'bank_transfer')->whereNull('reconciled_at')->latest('id')->first();
        $breakdown = (new InvoiceBreakdown)->build($invoice);

        return [
            'invoice_number' => $invoice->invoice_number,
            'order_number' => $order?->order_number,
            'status' => $invoice->status,
            'reconciliation_status' => $invoice->reconciliation_status,
            'issued_at' => $invoice->issued_at?->toDateString(),
            'due_at' => $invoice->due_at?->toDateString(),
            'paid_at' => $invoice->paid_at?->toDateString(),
            'from' => [
                'name' => config('company.name'),
                'address_lines' => config('company.address_lines'),
                'phone' => config('company.phone'),
                'email' => config('company.email'),
                'website' => config('company.website'),
                'rc_number' => config('company.rc_number'),
                'tin' => config('company.tin'),
            ],
            'bill_to' => [
                'name' => $client->company_name ?: $request->user()->name,
                'address_lines' => array_values(array_filter([$client->billing_address ?: $client->address, $client->city, $client->country])),
                'email' => $client->billing_email ?: $request->user()->email,
                'phone' => $client->billing_phone,
                'tax_id' => $client->tax_id,
            ],
            'line_items' => collect($invoice->line_items)->map(fn (array $item) => [
                'description' => $item['description'],
                'quantity' => $item['quantity'],
                'unit_price' => Money::naira($item['unit_price_kobo'] ?? (int) round($item['total_kobo'] / max((int) $item['quantity'], 1))),
                'total' => Money::naira($item['total_kobo']),
            ])->all(),
            'subtotal' => $breakdown['subtotal'],
            'discount' => Money::naira($invoice->discount_kobo),
            'vat_rate' => $breakdown['vat_rate'],
            'vat_label' => $breakdown['vat_label'],
            'tax' => $breakdown['vat_amount'],
            'total' => $breakdown['total'],
            'amount_paid' => $breakdown['amount_paid'],
            'wallet_amount_applied' => $breakdown['wallet_amount_applied'],
            'wallet_amount_applied_kobo' => $breakdown['wallet_amount_applied_kobo'],
            'overpayment_amount' => $breakdown['overpayment_amount'],
            'overpayment_amount_kobo' => $breakdown['overpayment_amount_kobo'],
            'underpayment_amount' => $breakdown['underpayment_amount'],
            'underpayment_amount_kobo' => $breakdown['underpayment_amount_kobo'],
            'outstanding_amount' => $breakdown['outstanding_amount'],
            'outstanding_amount_kobo' => $breakdown['outstanding_amount_kobo'],
            'balance_due' => $breakdown['balance_due'],
            'receipt_available' => $invoice->amount_paid_kobo > 0,
            'bank_transfer' => config('services.bank_transfer'),
            'bank_transfer_status' => $bankTransferPayment?->status,
            'bank_transfer_rejection_reason' => $bankTransferPayment?->gateway_payload['rejection_reason'] ?? null,
        ];
    }
}
