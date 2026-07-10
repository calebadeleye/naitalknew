<?php

namespace App\Http\Controllers\Api\Client;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\SavedPaymentMethod;
use App\Services\Payments\ChargeSavedCardService;
use App\Services\Payments\ReconcileInvoicePaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Charges one of the client's own saved, enabled payment methods against an
 * invoice — the "pay with a card on file" option alongside wallet/gateway/
 * bank-transfer. Reuses the same ChargeSavedCardService as auto-renewal and
 * settles through ReconcileInvoicePaymentService like every other channel.
 */
class SavedCardPaymentController extends Controller
{
    public function pay(Request $request, Invoice $invoice, SavedPaymentMethod $paymentMethod, ChargeSavedCardService $chargeService, ReconcileInvoicePaymentService $reconciler)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');
        abort_if($invoice->client_id !== $client->id, 403, 'This invoice does not belong to your account.');
        abort_if($invoice->status === 'paid', 422, 'This invoice has already been paid.');
        abort_if($paymentMethod->client_id !== $client->id, 403, 'This payment method does not belong to your account.');
        abort_if(! $paymentMethod->is_active, 422, 'This payment method is disabled.');

        $outstandingKobo = $invoice->outstanding_amount_kobo ?: max($invoice->total_kobo - $invoice->amount_paid_kobo, 0);

        abort_if($outstandingKobo <= 0, 422, 'There is nothing outstanding on this invoice.');

        $reference = 'CARD-'.Str::upper(Str::random(12));
        $email = $request->user()->email;

        $payment = Payment::query()->create([
            'client_id' => $client->id,
            'invoice_id' => $invoice->id,
            'gateway' => $paymentMethod->payment_provider,
            'purpose' => 'invoice_payment',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $outstandingKobo,
            'currency' => 'NGN',
        ]);

        try {
            $result = $chargeService->charge($paymentMethod, $outstandingKobo, $reference, $email);
        } catch (PaymentGatewayException $exception) {
            $payment->forceFill(['status' => 'failed', 'gateway_payload' => ['error' => $exception->getMessage()]])->save();

            return response()->json(['message' => $exception->getMessage()], 422);
        }

        if (! $result['successful']) {
            $payment->forceFill(['status' => 'failed', 'gateway_payload' => $result['raw'] ?? []])->save();

            return response()->json(['message' => 'Your saved card was declined. Please try another payment method.'], 422);
        }

        $invoice = $reconciler->reconcile($invoice, $payment, $result['amount_kobo'], $paymentMethod->payment_provider, [
            'actor' => $request->user(),
            'gateway_payload' => $result['raw'],
        ]);

        return response()->json([
            'message' => $invoice->status === 'paid' ? 'Payment successful using your saved card.' : 'Card payment received.',
            'invoice' => $invoice->fresh(),
        ]);
    }
}
