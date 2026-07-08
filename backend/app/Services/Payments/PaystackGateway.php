<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use Illuminate\Support\Facades\Http;

class PaystackGateway
{
    public function initialize(string $email, int $amountKobo, string $reference, string $callbackUrl): array
    {
        $response = Http::withToken((string) config('services.paystack.secret_key'))
            ->baseUrl('https://api.paystack.co')
            ->post('/transaction/initialize', [
                'email' => $email,
                'amount' => $amountKobo,
                'currency' => 'NGN',
                'reference' => $reference,
                'callback_url' => $callbackUrl,
            ]);

        if ($response->failed()) {
            throw new PaymentGatewayException($response->json('message') ?? 'Paystack could not initialize this payment.');
        }

        $data = $response->json('data') ?? [];

        return [
            'authorization_url' => $data['authorization_url'] ?? null,
            'access_code' => $data['access_code'] ?? null,
            'reference' => $data['reference'] ?? $reference,
        ];
    }

    public function verify(string $reference): array
    {
        $response = Http::withToken((string) config('services.paystack.secret_key'))
            ->baseUrl('https://api.paystack.co')
            ->get("/transaction/verify/{$reference}");

        if ($response->failed()) {
            throw new PaymentGatewayException($response->json('message') ?? 'Paystack could not verify this payment.');
        }

        $data = $response->json('data') ?? [];

        return [
            'successful' => ($data['status'] ?? null) === 'success',
            'amount_kobo' => (int) ($data['amount'] ?? 0),
            'currency' => $data['currency'] ?? 'NGN',
            'reference' => $data['reference'] ?? $reference,
            'raw' => $data,
        ];
    }

    public function verifyWebhookSignature(string $rawPayload, ?string $signature): bool
    {
        if (! $signature) {
            return false;
        }

        $expected = hash_hmac('sha512', $rawPayload, (string) config('services.paystack.secret_key'));

        return hash_equals($expected, $signature);
    }
}
