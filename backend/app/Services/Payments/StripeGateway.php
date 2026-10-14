<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use Illuminate\Support\Facades\Http;

/**
 * Stripe Checkout (hosted payment page) over the plain REST API — no SDK.
 * The client is sent to Stripe; we confirm the result by fetching the
 * Checkout Session server-side, never by trusting the redirect.
 */
class StripeGateway
{
    public function __construct(private readonly PaymentMethodSettings $settings = new PaymentMethodSettings)
    {
    }

    /**
     * @return array{redirect_url: string, session_id: string}
     */
    public function createCheckout(string $email, string $description, string $currency, int $amountMinor, string $reference, string $successUrl, string $cancelUrl): array
    {
        $response = $this->http()->asForm()->post('/v1/checkout/sessions', [
            'mode' => 'payment',
            'customer_email' => $email,
            'client_reference_id' => $reference,
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'line_items[0][quantity]' => 1,
            'line_items[0][price_data][currency]' => strtolower($currency),
            'line_items[0][price_data][unit_amount]' => $amountMinor,
            'line_items[0][price_data][product_data][name]' => $description,
            'metadata[reference]' => $reference,
        ]);

        if ($response->failed() || ! $response->json('url')) {
            throw new PaymentGatewayException($response->json('error.message') ?? 'Stripe could not start this payment.');
        }

        return ['redirect_url' => $response->json('url'), 'session_id' => $response->json('id')];
    }

    /**
     * @return array{successful: bool, amount_minor: int, currency: string, raw: array}
     */
    public function retrieveSession(string $sessionId): array
    {
        $response = $this->http()->get('/v1/checkout/sessions/'.urlencode($sessionId));

        if ($response->failed()) {
            throw new PaymentGatewayException($response->json('error.message') ?? 'Stripe could not verify this payment.');
        }

        $data = $response->json() ?? [];

        return [
            'successful' => ($data['payment_status'] ?? null) === 'paid',
            'amount_minor' => (int) ($data['amount_total'] ?? 0),
            'currency' => strtoupper((string) ($data['currency'] ?? '')),
            'raw' => array_intersect_key($data, array_flip(['id', 'payment_status', 'status', 'amount_total', 'currency', 'payment_intent', 'client_reference_id'])),
        ];
    }

    /**
     * Checks the Stripe-Signature header (t=...,v1=...) against the webhook
     * signing secret, rejecting anything older than five minutes.
     */
    public function verifyWebhookSignature(string $payload, ?string $header, int $toleranceSeconds = 300): bool
    {
        $secret = (string) $this->settings->value('stripe', 'webhook_secret');

        if ($secret === '' || ! $header) {
            return false;
        }

        $parts = [];
        foreach (explode(',', $header) as $item) {
            [$key, $value] = array_pad(explode('=', trim($item), 2), 2, '');
            $parts[$key][] = $value;
        }

        $timestamp = (int) ($parts['t'][0] ?? 0);

        if ($timestamp === 0 || abs(time() - $timestamp) > $toleranceSeconds) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$payload, $secret);

        foreach ($parts['v1'] ?? [] as $signature) {
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        return false;
    }

    private function http()
    {
        return Http::withToken((string) $this->settings->value('stripe', 'secret_key'))->baseUrl('https://api.stripe.com')->timeout(20);
    }
}
