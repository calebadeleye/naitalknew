<?php

namespace App\Services\Payments;

use App\Models\Client;
use App\Models\SavedPaymentMethod;

/**
 * Captures only the safe, reusable reference a gateway returns after a
 * successful charge (Paystack's authorization_code, Flutterwave's card
 * token) — never the PAN, CVV, or any other raw card data, which never
 * transits or is stored by NAI TALK at all.
 */
class SavedPaymentMethodService
{
    /**
     * @param  array<string, mixed>  $rawPayload
     */
    public function captureFromGatewayPayload(Client $client, string $provider, array $rawPayload): ?SavedPaymentMethod
    {
        return match ($provider) {
            'paystack' => $this->captureFromPaystack($client, $rawPayload),
            'flutterwave' => $this->captureFromFlutterwave($client, $rawPayload),
            default => null,
        };
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function captureFromPaystack(Client $client, array $data): ?SavedPaymentMethod
    {
        $authorization = $data['authorization'] ?? null;

        if (! is_array($authorization) || empty($authorization['authorization_code']) || ($authorization['reusable'] ?? false) !== true) {
            return null;
        }

        return SavedPaymentMethod::query()->updateOrCreate(
            [
                'client_id' => $client->id,
                'payment_provider' => 'paystack',
                'provider_authorization_code' => $authorization['authorization_code'],
            ],
            [
                'provider_customer_id' => $data['customer']['customer_code'] ?? null,
                'card_brand' => $authorization['brand'] ?? $authorization['card_type'] ?? null,
                'last4' => $authorization['last4'] ?? null,
                'exp_month' => isset($authorization['exp_month']) ? (int) $authorization['exp_month'] : null,
                'exp_year' => isset($authorization['exp_year']) ? (int) $authorization['exp_year'] : null,
                'is_active' => true,
            ]
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function captureFromFlutterwave(Client $client, array $data): ?SavedPaymentMethod
    {
        $card = $data['card'] ?? null;
        $token = is_array($card) ? ($card['token'] ?? null) : null;

        if (! is_array($card) || ! $token) {
            return null;
        }

        [$expMonth, $expYear] = $this->parseFlutterwaveExpiry($card['expiry'] ?? null);

        return SavedPaymentMethod::query()->updateOrCreate(
            [
                'client_id' => $client->id,
                'payment_provider' => 'flutterwave',
                'provider_authorization_code' => $token,
            ],
            [
                'provider_customer_id' => $data['customer']['id'] ?? null,
                'card_brand' => $card['type'] ?? null,
                'last4' => $card['last_4digits'] ?? null,
                'exp_month' => $expMonth,
                'exp_year' => $expYear,
                'is_active' => true,
            ]
        );
    }

    /**
     * @return array{0: ?int, 1: ?int}
     */
    private function parseFlutterwaveExpiry(?string $expiry): array
    {
        if (! $expiry || ! str_contains($expiry, '/')) {
            return [null, null];
        }

        [$month, $year] = array_map('trim', explode('/', $expiry, 2));
        $year = strlen($year) === 2 ? (int) ('20'.$year) : (int) $year;

        return [(int) $month, $year];
    }

    public function setDefault(SavedPaymentMethod $method): void
    {
        SavedPaymentMethod::query()
            ->where('client_id', $method->client_id)
            ->where('id', '!=', $method->id)
            ->update(['is_default' => false]);

        $method->forceFill(['is_default' => true])->save();
    }

    /**
     * The card auto-renewal should charge: the client's default card among
     * those explicitly enabled for auto-renewal use, never a disabled one.
     */
    public function defaultAutoRenewalMethod(Client $client): ?SavedPaymentMethod
    {
        return SavedPaymentMethod::query()
            ->where('client_id', $client->id)
            ->where('is_active', true)
            ->where('use_for_auto_renewal', true)
            ->orderByDesc('is_default')
            ->orderByDesc('created_at')
            ->first();
    }
}
