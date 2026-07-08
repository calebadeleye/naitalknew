<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use Illuminate\Support\Facades\Http;

class FlutterwaveGateway
{
    public function initialize(string $email, string $name, int $amountKobo, string $reference, string $redirectUrl): array
    {
        $response = Http::withToken((string) config('services.flutterwave.secret_key'))
            ->baseUrl('https://api.flutterwave.com/v3')
            ->post('/payments', [
                'tx_ref' => $reference,
                'amount' => round($amountKobo / 100, 2),
                'currency' => 'NGN',
                'redirect_url' => $redirectUrl,
                'customer' => [
                    'email' => $email,
                    'name' => $name,
                ],
            ]);

        if ($response->failed()) {
            throw new PaymentGatewayException($response->json('message') ?? 'Flutterwave could not initialize this payment.');
        }

        $data = $response->json('data') ?? [];

        return [
            'link' => $data['link'] ?? null,
            'reference' => $reference,
        ];
    }

    public function verify(string $reference): array
    {
        $response = Http::withToken((string) config('services.flutterwave.secret_key'))
            ->baseUrl('https://api.flutterwave.com/v3')
            ->get('/transactions/verify_by_reference', ['tx_ref' => $reference]);

        if ($response->failed()) {
            throw new PaymentGatewayException($response->json('message') ?? 'Flutterwave could not verify this payment.');
        }

        $data = $response->json('data') ?? [];

        return [
            'successful' => ($data['status'] ?? null) === 'successful',
            'amount_kobo' => isset($data['amount']) ? (int) round(((float) $data['amount']) * 100) : 0,
            'currency' => $data['currency'] ?? 'NGN',
            'reference' => $data['tx_ref'] ?? $reference,
            'raw' => $data,
        ];
    }

    public function verifyWebhookSignature(?string $signature): bool
    {
        $expected = config('services.flutterwave.webhook_hash');

        if (! $expected || ! $signature) {
            return false;
        }

        return hash_equals((string) $expected, $signature);
    }
}
