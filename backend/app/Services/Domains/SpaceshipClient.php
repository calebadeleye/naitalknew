<?php

namespace App\Services\Domains;

use App\Exceptions\SpaceshipApiException;
use App\Models\DomainSyncLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Thin HTTP wrapper around the Spaceship domain registrar API
 * (https://docs.spaceship.dev/, base https://spaceship.dev/api/v1,
 * auth via X-API-Key/X-API-Secret headers) — mirrors the shape of
 * PaystackGateway/FlutterwaveGateway so it fits the same conventions.
 *
 * Spaceship has no public sandbox environment. When sandbox_mode is true
 * (the default — see config('services.spaceship.sandbox_mode')) every call
 * is simulated locally instead of touching the live, real-money, irreversible
 * API. Callers never need to know which mode is active; the response shape
 * is identical either way.
 *
 * Every call — real or simulated — writes one DomainSyncLog row, and never
 * logs the API key/secret or an EPP/auth code.
 */
class SpaceshipClient
{
    private const TIMEOUT_SECONDS = 15;

    private const RETRY_TIMES = 3;

    private const RETRY_SLEEP_MS = 500;

    public function checkAvailability(string $domain): array
    {
        $response = $this->request('GET', "/domains/{$domain}/available", [], action: 'availability_check', dryRun: fn () => [
            'domain' => $domain,
            'available' => ! Str::contains($domain, 'taken'),
            'premium' => Str::contains($domain, 'premium'),
        ], forceLive: true);

        return $this->normalizeAvailability($response, $domain);
    }

    /**
     * Checks up to 20 domains in a single call — used to check every
     * generated alternative-name suggestion without hammering the API once
     * per candidate. Real endpoint: POST /domains/available.
     *
     * @param  array<int, string>  $domains
     * @return array<int, array{domain: string, available: bool, premium: bool}>
     */
    public function checkAvailabilityBulk(array $domains): array
    {
        $domains = array_values(array_slice($domains, 0, 20));

        $response = $this->request('POST', '/domains/available', ['domains' => $domains], action: 'availability_check_bulk', dryRun: fn () => [
            'results' => array_map(fn (string $domain) => [
                'domain' => $domain,
                'available' => ! Str::contains($domain, 'taken'),
                'premium' => Str::contains($domain, 'premium'),
            ], $domains),
        ], forceLive: true);

        // The real API returns either a bare list or {"results": [...]} —
        // handled defensively since this has never been exercised for real.
        $items = $response['results'] ?? (array_is_list($response) ? $response : []);

        return array_map(fn (array $item) => $this->normalizeAvailability($item, $item['domain'] ?? ''), $items);
    }

    /**
     * Normalizes both the dry-run shape ({domain, available, premium}) and
     * the real Spaceship shape ({domain, result: "available"|"taken"|
     * "tldNotSupported"|..., premiumPricing}) into one consistent shape.
     *
     * "tldNotSupported" means this Spaceship account/API tier simply can't
     * sell that extension at all (observed for .ng/.com.ng/.org.ng) — this is
     * a materially different, admin-actionable condition from "someone else
     * already owns this name", so it's surfaced as its own flag rather than
     * being silently folded into "unavailable".
     *
     * @param  array<string, mixed>  $response
     * @return array{domain: string, available: bool, premium: bool, tld_supported: bool}
     */
    private function normalizeAvailability(array $response, string $domain): array
    {
        $available = array_key_exists('available', $response)
            ? (bool) $response['available']
            : (($response['result'] ?? null) === 'available');

        $premium = array_key_exists('premium', $response)
            ? (bool) $response['premium']
            : ! empty($response['premiumPricing']);

        $tldSupported = Str::lower((string) ($response['result'] ?? '')) !== 'tldnotsupported';

        return [
            'domain' => $response['domain'] ?? $domain,
            'available' => $available,
            'premium' => $premium,
            'tld_supported' => $tldSupported,
        ];
    }

    /**
     * @param  array<string, mixed>  $contact
     * @return string the provider's contact ID
     */
    public function createContact(array $contact): string
    {
        $response = $this->request('POST', '/contacts', $contact, action: 'create_contact', dryRun: fn () => [
            'id' => 'dryrun-contact-'.Str::upper(Str::random(10)),
        ]);

        return (string) ($response['id'] ?? $response['contactId'] ?? '');
    }

    /**
     * @param  array<string, mixed>  $payload  {autoRenew, years, privacyProtection, contacts}
     * @return array{operation_id: ?string, raw: array}
     */
    public function registerDomain(string $domain, array $payload): array
    {
        $response = $this->request('POST', "/domains/{$domain}", $payload, action: 'register_domain', dryRun: fn () => [
            'operationId' => 'dryrun-op-'.Str::upper(Str::random(10)),
            'domainId' => 'dryrun-domain-'.Str::upper(Str::random(10)),
            'expirationDate' => now()->addYear()->toIso8601String(),
        ]);

        return [
            'operation_id' => $response['operationId'] ?? null,
            'raw' => $response,
        ];
    }

    /**
     * @param  array<string, mixed>  $contacts
     */
    public function initiateTransfer(string $domain, string $eppCode, array $contacts): array
    {
        $response = $this->request('POST', "/domains/{$domain}/transfer", [
            'authCode' => $eppCode,
            'contacts' => $contacts,
        ], action: 'initiate_transfer', dryRun: fn () => [
            'operationId' => 'dryrun-op-'.Str::upper(Str::random(10)),
            'transferId' => 'dryrun-transfer-'.Str::upper(Str::random(10)),
        ]);

        return [
            'operation_id' => $response['operationId'] ?? null,
            'raw' => $response,
        ];
    }

    public function getTransferStatus(string $domain): array
    {
        return $this->request('GET', "/domains/{$domain}/transfer", [], action: 'transfer_status', dryRun: fn () => [
            'status' => 'pending',
        ]);
    }

    public function getAsyncOperation(string $operationId): array
    {
        return $this->request('GET', "/async-operations/{$operationId}", [], action: 'async_operation_status', dryRun: fn () => [
            'status' => 'success',
        ]);
    }

    public function renewDomain(string $domain, int $years = 1): array
    {
        return $this->request('POST', "/domains/{$domain}/renew", ['years' => $years], action: 'renew_domain', dryRun: fn () => [
            'status' => 'success',
            'expirationDate' => now()->addYears($years)->toIso8601String(),
        ]);
    }

    public function getDomainInfo(string $domain): array
    {
        return $this->request('GET', "/domains/{$domain}", [], action: 'domain_info', dryRun: fn () => [
            'name' => $domain,
            'status' => 'active',
        ], forceLive: true);
    }

    /**
     * Pulls the TLD price list (registration/renewal/transfer, in the
     * provider's own currency — typically USD minor units/cents).
     *
     * CONFIRMED against Spaceship's official API docs (docs.spaceship.dev):
     * there is currently NO bulk TLD pricing/price-list endpoint, and no
     * account wallet/balance endpoint either. Availability checks
     * (checkAvailability/checkAvailabilityBulk) don't return standard
     * registration/renewal pricing — only a premiumPricing field for
     * premium-domain surcharges. `/domains/tlds` below is therefore
     * necessarily speculative — it exists only so this call fails safely
     * (SpaceshipTldPricingSyncService leaves existing prices untouched and
     * logs the failure) rather than being left unimplemented, and so the
     * sync/markup/idempotency machinery built around it has something to
     * call. Until Spaceship adds a real pricing endpoint, TLD provider
     * costs must be entered manually in the admin pricing page — this is
     * communicated in the admin UI, not silently hidden.
     *
     * @return array<int, array{tld: string, currency: string, registrationPrice: int, renewalPrice: int, transferPrice: int}>
     */
    public function listTldPricing(): array
    {
        $response = $this->request('GET', '/domains/tlds', [], action: 'tld_pricing_sync', dryRun: fn () => [
            'items' => [
                ['tld' => '.com', 'currency' => 'USD', 'registrationPrice' => 1298, 'renewalPrice' => 1298, 'transferPrice' => 1298],
                ['tld' => '.net', 'currency' => 'USD', 'registrationPrice' => 1498, 'renewalPrice' => 1498, 'transferPrice' => 1498],
                ['tld' => '.org', 'currency' => 'USD', 'registrationPrice' => 1398, 'renewalPrice' => 1398, 'transferPrice' => 1398],
                ['tld' => '.ng', 'currency' => 'USD', 'registrationPrice' => 2500, 'renewalPrice' => 2500, 'transferPrice' => 2500],
                ['tld' => '.com.ng', 'currency' => 'USD', 'registrationPrice' => 1800, 'renewalPrice' => 1800, 'transferPrice' => 1800],
                ['tld' => '.org.ng', 'currency' => 'USD', 'registrationPrice' => 1800, 'renewalPrice' => 1800, 'transferPrice' => 1800],
            ],
        ], forceLive: true);

        // Defensive against either a bare list or a {"items"/"data": [...]} envelope.
        $items = $response['items'] ?? $response['data'] ?? (array_is_list($response) ? $response : []);

        return array_map(fn (array $item) => [
            'tld' => Str::lower((string) ($item['tld'] ?? $item['name'] ?? '')),
            'currency' => Str::upper((string) ($item['currency'] ?? 'USD')),
            'registrationPrice' => (int) ($item['registrationPrice'] ?? $item['registration_price'] ?? 0),
            'renewalPrice' => (int) ($item['renewalPrice'] ?? $item['renewal_price'] ?? 0),
            'transferPrice' => (int) ($item['transferPrice'] ?? $item['transfer_price'] ?? 0),
        ], $items);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  callable(): array<string, mixed>  $dryRun
     * @param  bool  $forceLive  Read-only, non-billable calls (availability
     *                           checks, domain info lookups) always hit the
     *                           real API as soon as real credentials are
     *                           configured, regardless of sandbox_mode —
     *                           registration/transfer/renewal stay gated by
     *                           sandbox_mode since those are billable and
     *                           irreversible.
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $payload, string $action, callable $dryRun, bool $forceLive = false): array
    {
        $reference = (string) Str::uuid();
        $hasRealCredentials = filled(config('services.spaceship.api_key')) && filled(config('services.spaceship.api_secret'));
        // Automated tests must NEVER make a real network call, even with
        // real credentials configured in .env — this is an absolute
        // invariant, not just a default.
        $canForceLive = $forceLive && $hasRealCredentials && ! app()->environment('testing');
        $sandbox = $canForceLive ? false : (bool) config('services.spaceship.sandbox_mode');

        if ($sandbox) {
            $response = $dryRun();
            $this->log($action, 'dry_run', $reference, $response);

            return $response;
        }

        try {
            $http = Http::withHeaders([
                'X-API-Key' => (string) config('services.spaceship.api_key'),
                'X-API-Secret' => (string) config('services.spaceship.api_secret'),
                'Accept' => 'application/json',
            ])
                ->baseUrl((string) config('services.spaceship.base_url'))
                ->timeout(self::TIMEOUT_SECONDS)
                ->retry(self::RETRY_TIMES, self::RETRY_SLEEP_MS, function ($exception, $request) {
                    return $exception instanceof \Illuminate\Http\Client\RequestException
                        && in_array($exception->response->status(), [429, 500, 502, 503, 504], true);
                }, throw: false);

            $response = match ($method) {
                'GET' => $http->get($path, $payload),
                'POST' => $http->post($path, $payload),
                default => throw new SpaceshipApiException("Unsupported HTTP method: {$method}"),
            };
        } catch (\Throwable $exception) {
            // Never log $exception's request/response — it may carry secrets/EPP codes.
            Log::warning('Spaceship API call failed to connect.', ['action' => $action, 'reference' => $reference]);
            $this->log($action, 'error', $reference, [], $exception->getMessage());

            throw new SpaceshipApiException("Spaceship API request failed for {$action}.", previous: $exception);
        }

        if ($response->failed()) {
            $message = $response->json('message') ?? $response->json('error') ?? 'Spaceship API request failed.';
            $this->log($action, 'failed', $reference, $this->sanitize($response->json() ?? []), $message);

            throw new SpaceshipApiException($message);
        }

        $body = $response->json() ?? [];
        $this->log($action, 'success', $reference, $this->sanitize($body));

        // Async operations (registration/transfer) answer 202 with the
        // operation id in a response header rather than the body.
        if ($response->status() === 202 && $response->header('spaceship-async-operationid')) {
            $body['operationId'] = $response->header('spaceship-async-operationid');
        }

        return $body;
    }

    /**
     * @param  array<string, mixed>  $response
     */
    private function log(string $action, string $status, string $reference, array $response, ?string $error = null): void
    {
        DomainSyncLog::query()->create([
            'domain_id' => null,
            'provider' => 'spaceship',
            'action' => $action,
            'status' => $status,
            'request_reference' => $reference,
            'response_summary' => $this->sanitize($response),
            'error_message' => $error,
        ]);
    }

    /**
     * Strips anything that could be a secret/EPP code before it's ever
     * persisted or logged.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function sanitize(array $data): array
    {
        $blocked = ['authcode', 'auth_code', 'eppcode', 'epp_code', 'apikey', 'api_key', 'apisecret', 'api_secret', 'password'];

        return collect($data)->reject(function ($value, $key) use ($blocked) {
            return in_array(Str::lower((string) $key), $blocked, true);
        })->all();
    }
}
