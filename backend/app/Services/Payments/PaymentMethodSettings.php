<?php

namespace App\Services\Payments;

use App\Models\AppSetting;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Crypt;

/**
 * Which payment methods clients are offered, and the keys each gateway uses —
 * set by an admin from the dashboard (Pricing → Payment methods).
 *
 * Secrets are encrypted with APP_KEY before they are stored and are never sent
 * back to the browser (only "set" / the last 4 characters). Paystack and
 * Flutterwave fall back to their .env keys, so they keep working exactly as
 * before until an admin changes anything.
 */
class PaymentMethodSettings
{
    public const SETTING_KEY = 'payment_methods';

    /**
     * @var array<string, array{label: string, default_enabled: bool, fields: array<string, array{label: string, secret?: bool, required?: bool, env?: string, default?: string, options?: array<int, string>}>}>
     */
    public const METHODS = [
        'paystack' => [
            'label' => 'Paystack',
            'default_enabled' => true,
            'fields' => [
                'public_key' => ['label' => 'Public key', 'env' => 'services.paystack.public_key'],
                'secret_key' => ['label' => 'Secret key', 'secret' => true, 'required' => true, 'env' => 'services.paystack.secret_key'],
            ],
        ],
        'flutterwave' => [
            'label' => 'Flutterwave',
            'default_enabled' => true,
            'fields' => [
                'public_key' => ['label' => 'Public key', 'env' => 'services.flutterwave.public_key'],
                'secret_key' => ['label' => 'Secret key', 'secret' => true, 'required' => true, 'env' => 'services.flutterwave.secret_key'],
                'webhook_hash' => ['label' => 'Webhook secret hash', 'secret' => true, 'env' => 'services.flutterwave.webhook_hash'],
            ],
        ],
        'stripe' => [
            'label' => 'Stripe',
            'default_enabled' => false,
            'fields' => [
                'secret_key' => ['label' => 'Secret key (sk_...)', 'secret' => true, 'required' => true],
                'webhook_secret' => ['label' => 'Webhook signing secret (whsec_...)', 'secret' => true],
                'currency' => ['label' => 'Charge in currency', 'default' => 'USD', 'options' => ['USD', 'NGN', 'GBP', 'EUR']],
                'ngn_rate' => ['label' => 'Naira per 1 unit of that currency'],
            ],
        ],
        'paypal' => [
            'label' => 'PayPal',
            'default_enabled' => false,
            'fields' => [
                'client_id' => ['label' => 'Client ID', 'required' => true],
                'client_secret' => ['label' => 'Client secret', 'secret' => true, 'required' => true],
                'mode' => ['label' => 'Mode', 'default' => 'live', 'options' => ['live', 'sandbox']],
                // PayPal does not accept Naira.
                'currency' => ['label' => 'Charge in currency', 'default' => 'USD', 'options' => ['USD', 'GBP', 'EUR']],
                'ngn_rate' => ['label' => 'Naira per 1 unit of that currency'],
            ],
        ],
        'bank_transfer' => [
            'label' => 'Bank transfer',
            'default_enabled' => true,
            'fields' => [],
        ],
    ];

    /** The gateways that redirect the client to a hosted payment page. */
    public const REDIRECT_GATEWAYS = ['paystack', 'flutterwave', 'stripe', 'paypal'];

    private ?array $cache = null;

    public function isEnabled(string $method): bool
    {
        if (! isset(self::METHODS[$method])) {
            return false;
        }

        return (bool) ($this->stored()[$method]['enabled'] ?? self::METHODS[$method]['default_enabled']);
    }

    /** Enabled by the admin AND has every key it needs — only then do clients see it. */
    public function isAvailable(string $method): bool
    {
        return $this->isEnabled($method) && $this->isConfigured($method);
    }

    public function isConfigured(string $method): bool
    {
        foreach (self::METHODS[$method]['fields'] ?? [] as $field => $definition) {
            if (($definition['required'] ?? false) && blank($this->value($method, $field))) {
                return false;
            }
        }

        // A foreign-currency gateway can't price a Naira invoice without a rate.
        if ($this->foreignCurrency($method) && $this->ngnRate($method) <= 0) {
            return false;
        }

        return true;
    }

    public function value(string $method, string $field): ?string
    {
        $definition = self::METHODS[$method]['fields'][$field] ?? null;

        if (! $definition) {
            return null;
        }

        $stored = $this->stored()[$method]['values'][$field] ?? null;

        if (filled($stored)) {
            if ($definition['secret'] ?? false) {
                try {
                    return Crypt::decryptString($stored);
                } catch (DecryptException) {
                    return null;
                }
            }

            return (string) $stored;
        }

        if (isset($definition['env']) && filled(config($definition['env']))) {
            return (string) config($definition['env']);
        }

        return $definition['default'] ?? null;
    }

    /** The currency a gateway charges in, when that isn't Naira (else null). */
    public function foreignCurrency(string $method): ?string
    {
        if (! isset(self::METHODS[$method]['fields']['currency'])) {
            return null;
        }

        $currency = strtoupper((string) $this->value($method, 'currency'));

        return $currency !== '' && $currency !== 'NGN' ? $currency : null;
    }

    public function ngnRate(string $method): float
    {
        return (float) $this->value($method, 'ngn_rate');
    }

    /**
     * What to charge on a gateway for a Naira amount: the same kobo when it
     * charges in Naira, otherwise converted at the admin's rate and rounded UP
     * to the next cent so the invoice is never under-collected.
     *
     * @return array{currency: string, amount_minor: int, ngn_rate: float|null}
     */
    public function chargeFor(string $method, int $amountKobo): array
    {
        $currency = $this->foreignCurrency($method);

        if (! $currency) {
            return ['currency' => 'NGN', 'amount_minor' => $amountKobo, 'ngn_rate' => null];
        }

        $rate = $this->ngnRate($method);

        return ['currency' => $currency, 'amount_minor' => (int) ceil($amountKobo / $rate), 'ngn_rate' => $rate];
    }

    /** @return array<int, array{method: string, label: string, currency: string}> */
    public function availableForClients(): array
    {
        return collect(array_keys(self::METHODS))
            ->filter(fn (string $method) => $this->isAvailable($method))
            ->map(fn (string $method) => [
                'method' => $method,
                'label' => self::METHODS[$method]['label'],
                'currency' => $this->foreignCurrency($method) ?? 'NGN',
            ])
            ->values()
            ->all();
    }

    /** What the admin screen shows — secrets reduced to "set" + last 4 characters. */
    public function adminView(): array
    {
        return collect(self::METHODS)->map(function (array $definition, string $method) {
            return [
                'method' => $method,
                'label' => $definition['label'],
                'enabled' => $this->isEnabled($method),
                'configured' => $this->isConfigured($method),
                'fields' => collect($definition['fields'])->map(function (array $field, string $name) use ($method) {
                    $value = $this->value($method, $name);
                    $isSecret = $field['secret'] ?? false;

                    return [
                        'name' => $name,
                        'label' => $field['label'],
                        'secret' => $isSecret,
                        'required' => $field['required'] ?? false,
                        'options' => $field['options'] ?? null,
                        'value' => $isSecret ? null : $value,
                        'is_set' => filled($value),
                        'hint' => $isSecret && filled($value) ? '••••'.substr($value, -4) : null,
                        'from_env' => blank($this->stored()[$method]['values'][$name] ?? null) && isset($field['env']) && filled(config($field['env'])),
                    ];
                })->values()->all(),
            ];
        })->values()->all();
    }

    /**
     * @param  array<string, string|null>  $values  blank secret = keep the current one
     */
    public function update(string $method, bool $enabled, array $values): void
    {
        $all = $this->stored();
        $current = $all[$method]['values'] ?? [];

        foreach (self::METHODS[$method]['fields'] as $field => $definition) {
            if (! array_key_exists($field, $values)) {
                continue;
            }

            $value = trim((string) $values[$field]);

            if ($definition['secret'] ?? false) {
                if ($value !== '') {
                    $current[$field] = Crypt::encryptString($value);
                }
            } else {
                $current[$field] = $value;
            }
        }

        $all[$method] = ['enabled' => $enabled, 'values' => $current];
        AppSetting::put(self::SETTING_KEY, $all);
        $this->cache = null;
    }

    private function stored(): array
    {
        try {
            return $this->cache ??= (array) AppSetting::get(self::SETTING_KEY, []);
        } catch (QueryException) {
            // Settings table unreachable: behave exactly as before this screen
            // existed — defaults on, keys from .env.
            return [];
        }
    }
}
