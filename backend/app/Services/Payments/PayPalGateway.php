<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentGatewayException;
use Illuminate\Support\Facades\Http;

/**
 * PayPal Checkout (Orders v2) over the REST API. The client approves the
 * order on PayPal; when PayPal sends them back we capture it server-side —
 * money only moves on that capture, and its result is what we record.
 */
class PayPalGateway
{
    public function __construct(private readonly PaymentMethodSettings $settings = new PaymentMethodSettings)
    {
    }

    /**
     * @return array{redirect_url: string, order_id: string}
     */
    public function createOrder(string $description, string $currency, int $amountMinor, string $reference, string $returnUrl, string $cancelUrl): array
    {
        $response = $this->http()->post('/v2/checkout/orders', [
            'intent' => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => $reference,
                'custom_id' => $reference,
                'description' => mb_substr($description, 0, 127),
                'amount' => ['currency_code' => strtoupper($currency), 'value' => $this->decimal($amountMinor)],
            ]],
            'application_context' => [
                'brand_name' => config('company.name', 'NAI TALK'),
                'user_action' => 'PAY_NOW',
                'shipping_preference' => 'NO_SHIPPING',
                'return_url' => $returnUrl,
                'cancel_url' => $cancelUrl,
            ],
        ]);

        $approve = collect($response->json('links') ?? [])->firstWhere('rel', 'approve')['href'] ?? null;

        if ($response->failed() || ! $approve) {
            throw new PaymentGatewayException($response->json('message') ?? 'PayPal could not start this payment.');
        }

        return ['redirect_url' => $approve, 'order_id' => $response->json('id')];
    }

    /**
     * Captures an approved order (capturing twice is answered by PayPal with
     * ORDER_ALREADY_CAPTURED, which we treat as "look it up").
     *
     * @return array{successful: bool, amount_minor: int, currency: string, raw: array}
     */
    public function capture(string $orderId): array
    {
        $response = $this->http()->withBody('{}', 'application/json')->post('/v2/checkout/orders/'.urlencode($orderId).'/capture');

        if ($response->failed() && collect($response->json('details') ?? [])->contains('issue', 'ORDER_ALREADY_CAPTURED')) {
            $response = $this->http()->get('/v2/checkout/orders/'.urlencode($orderId));
        }

        if ($response->failed()) {
            throw new PaymentGatewayException($response->json('message') ?? 'PayPal could not complete this payment.');
        }

        $capture = $response->json('purchase_units.0.payments.captures.0') ?? [];

        return [
            'successful' => $response->json('status') === 'COMPLETED' && ($capture['status'] ?? null) === 'COMPLETED',
            'amount_minor' => (int) round(((float) ($capture['amount']['value'] ?? 0)) * 100),
            'currency' => strtoupper((string) ($capture['amount']['currency_code'] ?? '')),
            'raw' => ['order_id' => $orderId, 'status' => $response->json('status'), 'capture_id' => $capture['id'] ?? null, 'capture_status' => $capture['status'] ?? null, 'amount' => $capture['amount'] ?? null],
        ];
    }

    private function http()
    {
        return Http::withToken($this->accessToken())->baseUrl($this->baseUrl())->acceptJson()->timeout(20);
    }

    private function accessToken(): string
    {
        $response = Http::asForm()
            ->withBasicAuth((string) $this->settings->value('paypal', 'client_id'), (string) $this->settings->value('paypal', 'client_secret'))
            ->baseUrl($this->baseUrl())
            ->timeout(20)
            ->post('/v1/oauth2/token', ['grant_type' => 'client_credentials']);

        if ($response->failed() || ! $response->json('access_token')) {
            throw new PaymentGatewayException('PayPal rejected the API credentials. Please check the PayPal settings.');
        }

        return (string) $response->json('access_token');
    }

    private function baseUrl(): string
    {
        return $this->settings->value('paypal', 'mode') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    }

    private function decimal(int $amountMinor): string
    {
        return number_format($amountMinor / 100, 2, '.', '');
    }
}
