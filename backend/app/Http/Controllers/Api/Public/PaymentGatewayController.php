<?php

namespace App\Http\Controllers\Api\Public;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Notifications\NaiTalkWalletFunded;
use App\Services\Notifications\ClientNotifier;
use App\Services\Payments\FlutterwaveGateway;
use App\Services\Payments\PaystackGateway;
use App\Services\Payments\ReconcileInvoicePaymentService;
use App\Services\Payments\SavedPaymentMethodService;
use App\Services\Wallet\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentGatewayController extends Controller
{
    public function paystackCallback(Request $request, PaystackGateway $gateway, ReconcileInvoicePaymentService $reconciler, WalletService $wallet, SavedPaymentMethodService $savedCards)
    {
        $reference = (string) $request->query('reference');

        return $this->settleAndRedirect($reference, fn () => $gateway->verify($reference), $reconciler, $wallet, $savedCards, 'paystack');
    }

    public function paystackWebhook(Request $request, PaystackGateway $gateway, ReconcileInvoicePaymentService $reconciler, WalletService $wallet, SavedPaymentMethodService $savedCards)
    {
        $signature = $request->header('x-paystack-signature');

        if (! $gateway->verifyWebhookSignature($request->getContent(), $signature)) {
            Log::warning('Rejected Paystack webhook with invalid signature.');

            abort(401, 'Invalid webhook signature.');
        }

        $reference = (string) data_get($request->json()->all(), 'data.reference');

        if (! $reference) {
            return response()->json(['message' => 'ignored']);
        }

        // Re-verify server-side rather than trusting the webhook payload directly.
        $this->settle($reference, fn () => $gateway->verify($reference), $reconciler, $wallet, $savedCards, 'paystack');

        return response()->json(['message' => 'ok']);
    }

    public function flutterwaveCallback(Request $request, FlutterwaveGateway $gateway, ReconcileInvoicePaymentService $reconciler, WalletService $wallet, SavedPaymentMethodService $savedCards)
    {
        $reference = (string) $request->query('tx_ref');

        return $this->settleAndRedirect($reference, fn () => $gateway->verify($reference), $reconciler, $wallet, $savedCards, 'flutterwave');
    }

    public function flutterwaveWebhook(Request $request, FlutterwaveGateway $gateway, ReconcileInvoicePaymentService $reconciler, WalletService $wallet, SavedPaymentMethodService $savedCards)
    {
        $signature = $request->header('verif-hash');

        if (! $gateway->verifyWebhookSignature($signature)) {
            Log::warning('Rejected Flutterwave webhook with invalid or missing verif-hash.');

            abort(401, 'Invalid webhook signature.');
        }

        $reference = (string) data_get($request->json()->all(), 'data.tx_ref');

        if (! $reference) {
            return response()->json(['message' => 'ignored']);
        }

        // Re-verify server-side rather than trusting the webhook payload directly.
        $this->settle($reference, fn () => $gateway->verify($reference), $reconciler, $wallet, $savedCards, 'flutterwave');

        return response()->json(['message' => 'ok']);
    }

    /**
     * @param  \Closure(): array  $verify
     */
    private function settle(string $reference, \Closure $verify, ReconcileInvoicePaymentService $reconciler, WalletService $wallet, SavedPaymentMethodService $savedCards, string $gateway): ?Payment
    {
        $payment = Payment::query()->where('reference', $reference)->first();

        if (! $payment) {
            return null;
        }

        try {
            $result = $verify();
        } catch (PaymentGatewayException $exception) {
            Log::warning('Payment gateway verification failed.', ['reference' => $reference, 'error' => $exception->getMessage()]);
            $payment->forceFill(['status' => 'failed', 'gateway_payload' => ['error' => $exception->getMessage()]])->save();

            return $payment->fresh();
        }

        if (! $result['successful']) {
            $payment->forceFill(['status' => 'failed', 'gateway_payload' => $result['raw'] ?? []])->save();

            return $payment->fresh();
        }

        if ($payment->purpose === 'wallet_topup') {
            $transaction = DB::transaction(function () use ($payment, $result, $gateway, $wallet) {
                $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();

                // Idempotency: a duplicate webhook/callback must never credit
                // the wallet twice for the same reference.
                if ($payment->reconciled_at !== null) {
                    return null;
                }

                $payment->forceFill([
                    'status' => 'paid',
                    'amount_kobo' => $result['amount_kobo'],
                    'paid_at' => now(),
                    'reconciled_at' => now(),
                    'gateway_payload' => $result['raw'],
                ])->save();

                return $wallet->credit($payment->client, $result['amount_kobo'], 'wallet_topup', [
                    'payment_reference' => $payment->reference,
                    'description' => 'Wallet top-up via '.$gateway,
                ]);
            });

            if ($transaction) {
                app(ClientNotifier::class)->notify(
                    $payment->client,
                    new NaiTalkWalletFunded($transaction),
                    'wallet_funded',
                    'Your NAI TALK wallet top-up was successful',
                );
            }
        } else {
            $reconciler->reconcile($payment->invoice, $payment, $result['amount_kobo'], $gateway, ['gateway_payload' => $result['raw']]);
        }

        $savedCards->captureFromGatewayPayload($payment->client, $gateway, $result['raw']);

        return $payment->fresh();
    }

    /**
     * @param  \Closure(): array  $verify
     */
    private function settleAndRedirect(string $reference, \Closure $verify, ReconcileInvoicePaymentService $reconciler, WalletService $wallet, SavedPaymentMethodService $savedCards, string $gateway)
    {
        $frontendUrl = rtrim(config('app.frontend_url'), '/');

        if (! $reference) {
            return redirect()->away($frontendUrl.'/client/orders?payment=not_found');
        }

        $payment = $this->settle($reference, $verify, $reconciler, $wallet, $savedCards, $gateway);

        if (! $payment) {
            return redirect()->away($frontendUrl.'/client/orders?payment=not_found');
        }

        $status = $payment->status === 'paid' ? 'success' : 'failed';

        if ($payment->purpose === 'wallet_topup') {
            return redirect()->away($frontendUrl.'/client/wallet?funding='.$status);
        }

        return redirect()->away($frontendUrl.'/client/orders?payment='.$status.'&invoice='.$payment->invoice->invoice_number);
    }
}
