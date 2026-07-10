<?php

namespace App\Http\Controllers\Api\Client;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\Payments\FlutterwaveGateway;
use App\Services\Payments\PaystackGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Wallet top-up reuses the exact same Paystack/Flutterwave initialize()
 * calls as invoice payments — only the Payment.purpose ('wallet_topup' vs
 * 'invoice_payment') differs, so PaymentGatewayController::settle() knows
 * to credit the wallet directly instead of reconciling an invoice.
 */
class WalletFundingController extends Controller
{
    public function paystack(Request $request, PaystackGateway $gateway)
    {
        $payload = $request->validate(['amount_kobo' => ['required', 'integer', 'min:100']]);
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $reference = 'WALLETFUND-'.Str::upper(Str::random(12));
        $callbackUrl = rtrim(config('app.url'), '/').'/api/v1/payments/paystack/callback';

        try {
            $result = $gateway->initialize($request->user()->email, $payload['amount_kobo'], $reference, $callbackUrl);
        } catch (PaymentGatewayException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        Payment::query()->create([
            'client_id' => $client->id,
            'invoice_id' => null,
            'gateway' => 'paystack',
            'purpose' => 'wallet_topup',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $payload['amount_kobo'],
            'currency' => 'NGN',
        ]);

        return response()->json(['authorization_url' => $result['authorization_url'], 'reference' => $reference]);
    }

    public function flutterwave(Request $request, FlutterwaveGateway $gateway)
    {
        $payload = $request->validate(['amount_kobo' => ['required', 'integer', 'min:100']]);
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $reference = 'WALLETFUND-'.Str::upper(Str::random(12));
        $redirectUrl = rtrim(config('app.url'), '/').'/api/v1/payments/flutterwave/callback';

        try {
            $result = $gateway->initialize($request->user()->email, $request->user()->name, $payload['amount_kobo'], $reference, $redirectUrl);
        } catch (PaymentGatewayException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        Payment::query()->create([
            'client_id' => $client->id,
            'invoice_id' => null,
            'gateway' => 'flutterwave',
            'purpose' => 'wallet_topup',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $payload['amount_kobo'],
            'currency' => 'NGN',
        ]);

        return response()->json(['link' => $result['link'], 'reference' => $reference]);
    }
}
