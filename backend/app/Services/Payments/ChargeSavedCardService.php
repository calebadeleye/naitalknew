<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use App\Models\SavedPaymentMethod;

/**
 * Normalizes a recurring charge against a saved card to the same
 * ['successful', 'amount_kobo', 'raw'] shape PaystackGateway::verify() /
 * FlutterwaveGateway::verify() already return, so the result feeds straight
 * into ReconcileInvoicePaymentService without any special-casing.
 */
class ChargeSavedCardService
{
    public function __construct(
        private readonly PaystackGateway $paystack,
        private readonly FlutterwaveGateway $flutterwave,
    ) {
    }

    public function charge(SavedPaymentMethod $method, int $amountKobo, string $reference, string $email): array
    {
        return match ($method->payment_provider) {
            'paystack' => $this->paystack->chargeAuthorization($method->provider_authorization_code, $email, $amountKobo, $reference),
            'flutterwave' => $this->flutterwave->chargeToken($method->provider_authorization_code, $amountKobo, $reference, $email),
            default => throw new PaymentGatewayException('Unsupported saved payment method provider: '.$method->payment_provider),
        };
    }
}
