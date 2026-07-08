<?php

namespace App\Http\Controllers\Api\Public;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\Payments\FlutterwaveGateway;
use App\Services\Payments\PaymentFulfillmentService;
use App\Services\Payments\PaystackGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentGatewayController extends Controller
{
    public function paystackCallback(Request $request, PaystackGateway $gateway, PaymentFulfillmentService $fulfillment)
    {
        $reference = (string) $request->query('reference');

        return $this->settleAndRedirect($reference, fn () => $gateway->verify($reference), $fulfillment);
    }

    public function paystackWebhook(Request $request, PaystackGateway $gateway, PaymentFulfillmentService $fulfillment)
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
        $this->settle($reference, fn () => $gateway->verify($reference), $fulfillment);

        return response()->json(['message' => 'ok']);
    }

    public function flutterwaveCallback(Request $request, FlutterwaveGateway $gateway, PaymentFulfillmentService $fulfillment)
    {
        $reference = (string) $request->query('tx_ref');

        return $this->settleAndRedirect($reference, fn () => $gateway->verify($reference), $fulfillment);
    }

    public function flutterwaveWebhook(Request $request, FlutterwaveGateway $gateway, PaymentFulfillmentService $fulfillment)
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
        $this->settle($reference, fn () => $gateway->verify($reference), $fulfillment);

        return response()->json(['message' => 'ok']);
    }

    /**
     * @param  \Closure(): array  $verify
     */
    private function settle(string $reference, \Closure $verify, PaymentFulfillmentService $fulfillment): ?Payment
    {
        $payment = Payment::query()->where('reference', $reference)->first();

        if (! $payment) {
            return null;
        }

        try {
            $result = $verify();
        } catch (PaymentGatewayException $exception) {
            Log::warning('Payment gateway verification failed.', ['reference' => $reference, 'error' => $exception->getMessage()]);
            $fulfillment->markPaymentFailed($payment, ['error' => $exception->getMessage()]);

            return $payment->fresh();
        }

        if ($result['successful'] && $result['amount_kobo'] >= $payment->invoice->total_kobo) {
            $fulfillment->markInvoicePaid($payment->invoice, $payment, $result['amount_kobo'], $result['raw']);
        } else {
            $fulfillment->markPaymentFailed($payment, $result['raw'] ?? []);
        }

        return $payment->fresh();
    }

    /**
     * @param  \Closure(): array  $verify
     */
    private function settleAndRedirect(string $reference, \Closure $verify, PaymentFulfillmentService $fulfillment)
    {
        $frontendUrl = rtrim(config('app.frontend_url'), '/');

        if (! $reference) {
            return redirect()->away($frontendUrl.'/client/orders?payment=not_found');
        }

        $payment = $this->settle($reference, $verify, $fulfillment);

        if (! $payment) {
            return redirect()->away($frontendUrl.'/client/orders?payment=not_found');
        }

        $status = $payment->status === 'paid' ? 'success' : 'failed';

        return redirect()->away($frontendUrl.'/client/orders?payment='.$status.'&invoice='.$payment->invoice->invoice_number);
    }
}
