<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\Payments\ReconcileInvoicePaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class InvoicePaymentController extends Controller
{
    public function markPaid(Request $request, Invoice $invoice, ReconcileInvoicePaymentService $reconciler)
    {
        abort_if($invoice->status === 'paid', 422, 'This invoice has already been paid.');

        $payload = $request->validate([
            'amount_kobo' => ['nullable', 'integer', 'min:1'],
        ]);

        $amountKobo = $payload['amount_kobo'] ?? $invoice->total_kobo;

        $payment = Payment::query()->firstOrNew(
            ['invoice_id' => $invoice->id, 'gateway' => 'bank_transfer'],
            [
                'client_id' => $invoice->client_id,
                'reference' => 'BANK-'.$invoice->invoice_number,
                'currency' => 'NGN',
            ]
        );
        $payment->status = 'pending';
        $payment->amount_kobo = $amountKobo;
        $payment->save();

        $reconciler->reconcile($invoice, $payment, $amountKobo, 'bank_transfer', [
            'actor' => $request->user(),
            'gateway_payload' => [
                'confirmed_by' => $request->user()->email,
                'method' => 'manual_admin_confirmation',
            ],
        ]);

        return response()->json(['message' => 'Invoice marked as paid.', 'invoice' => $invoice->fresh()]);
    }

    public function rejectBankTransfer(Request $request, Invoice $invoice)
    {
        $payload = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        $payment = Payment::query()->where('invoice_id', $invoice->id)->where('gateway', 'bank_transfer')->first();

        abort_if(! $payment, 404, 'No bank transfer payment found for this invoice.');

        $payment->forceFill([
            'status' => 'awaiting_bank_transfer',
            'gateway_payload' => array_merge($payment->gateway_payload ?? [], [
                'rejection_reason' => $payload['reason'],
                'rejected_by' => $request->user()->email,
            ]),
        ])->save();

        return response()->json(['message' => 'Bank transfer payment rejected.', 'payment' => $payment->fresh()]);
    }

    public function downloadReceipt(Payment $payment)
    {
        abort_if(! $payment->receipt_path, 404, 'No receipt uploaded for this payment.');

        return Storage::disk('local')->download($payment->receipt_path);
    }
}
