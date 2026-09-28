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

        // Defaults to what is still owed, so marking a part-paid invoice paid
        // settles the balance rather than re-adding the whole total.
        $amountKobo = $payload['amount_kobo'] ?? $invoice->payableKobo();

        // A fresh payment row per instalment: a second part payment against a
        // row that already reconciled would be dropped as a duplicate.
        $payment = $invoice->openBankTransferPayment('pending', $amountKobo);

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
