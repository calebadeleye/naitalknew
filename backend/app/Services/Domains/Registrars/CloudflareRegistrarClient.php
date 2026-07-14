<?php

namespace App\Services\Domains\Registrars;

use App\Exceptions\CloudflareApiException;
use App\Models\DomainSyncLog;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Thin HTTP wrapper around Cloudflare's Registrar API
 * (https://api.cloudflare.com/client/v4/accounts/{account_id}/registrar/domains,
 * auth via a scoped Bearer token) — deliberately mirrors SpaceshipClient's
 * exact conventions (one DomainSyncLog row per call, sandbox_mode gate,
 * absolute dry-run in the testing environment, retry-with-backoff) so both
 * registrars behave identically from the caller's perspective.
 *
 * ASSUMPTION FLAGGED FOR VERIFICATION: the exact request/response shape for
 * renew/register/transfer below is Cloudflare's documented Registrar API
 * shape as of this writing, but was not independently re-verified against
 * live Cloudflare docs during implementation (no live calls are made in
 * this phase — sandbox_mode defaults true exactly like Spaceship's). Confirm
 * the real endpoint paths and payload shapes before ever disabling
 * sandbox_mode in production.
 *
 * Every call — real or simulated — writes one DomainSyncLog row, and never
 * logs the API token.
 */
class CloudflareRegistrarClient
{
    private const TIMEOUT_SECONDS = 15;

    private const RETRY_TIMES = 3;

    private const RETRY_SLEEP_MS = 500;

    private const PROVIDER = 'cloudflare';

    /**
     * @return array{items: array<int, array<string, mixed>>, page: int, per_page: int, total_count: int, has_more: bool}
     */
    public function listRegistrations(?string $cursor = null, int $perPage = 50): array
    {
        $page = $cursor !== null ? max(1, (int) $cursor) : 1;

        $response = $this->request('GET', '/registrar/domains', ['page' => $page, 'per_page' => $perPage], action: 'full_sync', dryRun: fn () => [
            'result' => [],
            'result_info' => ['page' => $page, 'per_page' => $perPage, 'count' => 0, 'total_count' => 0],
        ], forceLive: true);

        $items = $response['result'] ?? [];
        $info = $response['result_info'] ?? [];
        $totalCount = (int) ($info['total_count'] ?? count($items));
        $currentPage = (int) ($info['page'] ?? $page);
        $perPageActual = (int) ($info['per_page'] ?? $perPage);

        return [
            'items' => $items,
            'page' => $currentPage,
            'per_page' => $perPageActual,
            'total_count' => $totalCount,
            'has_more' => ($currentPage * $perPageActual) < $totalCount,
        ];
    }

    /**
     * @return array<string, mixed>|null null when Cloudflare reports the
     *                                   domain doesn't exist (404) — a
     *                                   missing-domain result, not an error.
     */
    public function getRegistration(string $domainName): ?array
    {
        try {
            $response = $this->request('GET', "/registrar/domains/{$domainName}", [], action: 'single_sync', dryRun: fn () => [
                'result' => null,
            ], forceLive: true);
        } catch (CloudflareApiException $exception) {
            if (Str::contains(Str::lower($exception->getMessage()), 'not found')) {
                return null;
            }

            throw $exception;
        }

        return $response['result'] ?? null;
    }

    public function renewDomain(string $domainName, int $years = 1): array
    {
        $response = $this->request('PUT', "/registrar/domains/{$domainName}/renew", ['years' => $years], action: 'renewal', dryRun: fn () => [
            'result' => ['name' => $domainName, 'expires_at' => now()->addYears($years)->toIso8601String()],
        ]);

        return $response['result'] ?? [];
    }

    /**
     * @param  array<string, mixed>  $contacts
     */
    public function initiateTransfer(string $domainName, string $eppCode, array $contacts): array
    {
        $response = $this->request('POST', '/registrar/domains', [
            'name' => $domainName,
            'auth_code' => $eppCode,
            'contacts' => $contacts,
        ], action: 'transfer', dryRun: fn () => [
            'result' => ['name' => $domainName, 'transfer_in' => ['status' => 'pending']],
        ]);

        return $response['result'] ?? [];
    }

    public function setAutoRenew(string $domainName, bool $enabled): array
    {
        $response = $this->request('PUT', "/registrar/domains/{$domainName}", ['auto_renew' => $enabled], action: 'auto_renew_update', dryRun: fn () => [
            'result' => ['name' => $domainName, 'auto_renew' => $enabled],
        ]);

        return $response['result'] ?? [];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  callable(): array<string, mixed>  $dryRun
     * @param  bool  $forceLive  Read-only calls (list/get) always hit the
     *                           real API as soon as real credentials are
     *                           configured, regardless of sandbox_mode —
     *                           renew/transfer/auto-renew-change stay gated
     *                           by sandbox_mode since those are billable
     *                           and/or irreversible.
     * @return array<string, mixed>
     */
    private function request(string $method, string $path, array $payload, string $action, callable $dryRun, bool $forceLive = false): array
    {
        $reference = (string) Str::uuid();
        $hasRealCredentials = filled(config('services.cloudflare.account_id')) && filled(config('services.cloudflare.registrar_api_token'));
        $canForceLive = $forceLive && $hasRealCredentials && ! app()->environment('testing');
        $sandbox = $canForceLive ? false : (bool) config('services.cloudflare.sandbox_mode');

        if ($sandbox) {
            $response = $dryRun();
            $this->log($action, 'dry_run', $reference, null, $response);

            return $response;
        }

        $accountId = (string) config('services.cloudflare.account_id');

        try {
            $http = Http::withToken((string) config('services.cloudflare.registrar_api_token'))
                ->acceptJson()
                ->baseUrl(rtrim((string) config('services.cloudflare.base_url'), '/')."/accounts/{$accountId}")
                ->timeout(self::TIMEOUT_SECONDS)
                ->retry(self::RETRY_TIMES, self::RETRY_SLEEP_MS, function ($exception, $request) {
                    return $exception instanceof RequestException
                        && in_array($exception->response->status(), [429, 500, 502, 503, 504], true);
                }, throw: false);

            $response = match ($method) {
                'GET' => $http->get($path, $payload),
                'POST' => $http->post($path, $payload),
                'PUT' => $http->put($path, $payload),
                default => throw new CloudflareApiException("Unsupported HTTP method: {$method}"),
            };
        } catch (\Throwable $exception) {
            // Never log $exception's request/response — it may carry the token.
            Log::warning('Cloudflare API call failed to connect.', ['action' => $action, 'reference' => $reference]);
            $this->log($action, 'error', $reference, null, [], $exception->getMessage());

            throw new CloudflareApiException("Cloudflare API request failed for {$action}.", previous: $exception);
        }

        if ($response->failed() || $response->json('success') === false) {
            $message = $response->json('errors.0.message') ?? $response->json('errors') ?? 'Cloudflare API request failed.';
            $message = is_array($message) ? json_encode($message) : (string) $message;
            $this->log($action, 'failed', $reference, $response->status(), $this->sanitize($response->json() ?? []), $message);

            throw new CloudflareApiException($message);
        }

        $body = $response->json() ?? [];
        $this->log($action, 'success', $reference, $response->status(), $this->sanitize($body));

        return $body;
    }

    /**
     * @param  array<string, mixed>|null  $response
     */
    private function log(string $action, string $status, string $reference, ?int $responseCode, ?array $response = [], ?string $error = null): void
    {
        $now = now();

        DomainSyncLog::query()->create([
            'domain_id' => null,
            'provider' => self::PROVIDER,
            'action' => $action,
            'status' => $status,
            'request_reference' => $reference,
            'response_code' => $responseCode,
            'response_summary' => $this->sanitize($response ?? []),
            'error_message' => $error,
            'started_at' => $now,
            'completed_at' => $now,
        ]);
    }

    /**
     * Strips anything that could be a credential before it's ever persisted
     * or logged. Extends Spaceship's blocked-key list with Cloudflare's auth
     * header/field names.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function sanitize(array $data): array
    {
        $blocked = [
            'authcode', 'auth_code', 'eppcode', 'epp_code', 'apikey', 'api_key', 'apisecret', 'api_secret', 'password',
            'authorization', 'api_token', 'x-auth-key', 'x-auth-email', 'account_id',
        ];

        return collect($data)->reject(function ($value, $key) use ($blocked) {
            return in_array(Str::lower((string) $key), $blocked, true);
        })->all();
    }
}
