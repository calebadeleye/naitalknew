<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\Billing\Money;
use App\Services\Payments\ReconcileInvoicePaymentService;
use App\Services\Wallet\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WalletPaymentController extends Controller
{
    /**
     * Applies as much of the client's wallet balance as possible to an
     * invoice. Covers both the "pay in full from wallet" case and the
     * "split payment" case (spec §7) — if the wallet can't cover the whole
     * outstanding balance, whatever it can cover is debited and recorded
     * now, and the client pays the remainder via the existing gateway/bank
     * transfer flows afterwards.
     */
    public function pay(Request $request, Invoice $invoice, WalletService $walletService, ReconcileInvoicePaymentService $reconciler)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');
        abort_if($invoice->client_id !== $client->id, 403, 'This invoice does not belong to your account.');
        abort_if($invoice->status === 'paid', 422, 'This invoice has already been paid.');

        $wallet = $walletService->walletFor($client);
        $outstandingKobo = $invoice->outstanding_amount_kobo ?: max($invoice->total_kobo - $invoice->amount_paid_kobo, 0);

        abort_if($outstandingKobo <= 0, 422, 'There is nothing outstanding on this invoice.');
        abort_if($wallet->balance_kobo <= 0, 422, 'Your wallet balance is empty.');

        $amountToApply = min($wallet->balance_kobo, $outstandingKobo);
        $reference = 'WALLETPAY-'.Str::upper(Str::random(12));

        $walletService->debit($client, $amountToApply, 'wallet_payment', [
            'invoice_id' => $invoice->id,
            'order_id' => $invoice->order_id,
            'payment_reference' => $reference,
            'actor' => $request->user(),
            'description' => "Wallet payment toward invoice {$invoice->invoice_number}",
        ]);

        $payment = Payment::query()->create([
            'client_id' => $client->id,
            'invoice_id' => $invoice->id,
            'gateway' => 'wallet',
            'purpose' => 'invoice_payment',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $amountToApply,
            'currency' => 'NGN',
        ]);

        $invoice = $reconciler->reconcile($invoice, $payment, $amountToApply, 'wallet', ['actor' => $request->user()]);

        $remainingKobo = $invoice->outstanding_amount_kobo;

        return response()->json([
            'message' => $invoice->status === 'paid'
                ? 'Invoice paid in full using your wallet balance.'
                : 'Your wallet balance of '.Money::naira($amountToApply).' has been applied. Please pay the remaining '.Money::naira($remainingKobo).' using another payment method.',
            'invoice' => $invoice->fresh(),
            'wallet_amount_applied_kobo' => $amountToApply,
            'remaining_kobo' => $remainingKobo,
        ]);
    }
}
