<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\Billing\Money;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function show(Request $request, Order $order)
    {
        return response()->json($this->buildInvoiceData($request, $order));
    }

    public function downloadPdf(Request $request, Order $order)
    {
        $invoice = $this->buildInvoiceData($request, $order);

        $pdf = Pdf::loadView('invoices.pdf', ['invoice' => $invoice]);

        return $pdf->download("invoice-{$invoice['invoice_number']}.pdf");
    }

    private function buildInvoiceData(Request $request, Order $order): array
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');
        abort_if($order->client_id !== $client->id, 404);

        $invoice = $order->invoice()->latest()->first();

        abort_if(! $invoice, 404, 'No invoice found for this order.');

        $bankTransferPayment = Payment::query()->where('invoice_id', $invoice->id)->where('gateway', 'bank_transfer')->first();

        return [
            'invoice_number' => $invoice->invoice_number,
            'order_number' => $order->order_number,
            'status' => $invoice->status,
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
            'subtotal' => Money::naira($invoice->subtotal_kobo),
            'discount' => Money::naira($invoice->discount_kobo),
            'tax' => Money::naira($invoice->tax_kobo),
            'total' => Money::naira($invoice->total_kobo),
            'amount_paid' => Money::naira($invoice->amount_paid_kobo),
            'balance_due' => Money::naira($invoice->total_kobo - $invoice->amount_paid_kobo),
            'bank_transfer' => config('services.bank_transfer'),
            'bank_transfer_status' => $bankTransferPayment?->status,
            'bank_transfer_rejection_reason' => $bankTransferPayment?->gateway_payload['rejection_reason'] ?? null,
        ];
    }
}
