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

    private function buildInvoiceData(Request $request, Invoice $invoice, ?Order $order): array
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');
        abort_if($invoice->client_id !== $client->id, 404);

        $bankTransferPayment = Payment::query()->where('invoice_id', $invoice->id)->where('gateway', 'bank_transfer')->first();
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
            'bank_transfer' => config('services.bank_transfer'),
            'bank_transfer_status' => $bankTransferPayment?->status,
            'bank_transfer_rejection_reason' => $bankTransferPayment?->gateway_payload['rejection_reason'] ?? null,
        ];
    }
}
