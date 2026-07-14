<?php

namespace App\Services\Domains\Registrars;

use App\Models\DomainSyncLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Separate, small client for Cloudflare's Zones API — used ONLY to
 * distinguish "Cloudflare DNS only" (a zone exists, but the domain is not
 * Registrar-registered/transferred with Cloudflare) from "Cloudflare
 * Registrar". A Cloudflare zone must never, by itself, be treated as a
 * Registrar registration — that classification only ever comes from
 * CloudflareRegistrarService/CloudflareRegistrarClient.
 *
 * Gated behind config('services.cloudflare.zones_lookup_enabled'), default
 * false: the registrar-scoped API token this integration is built around
 * may not include Zones:Read permission. When disabled, dnsProviderFor()
 * always returns null (unknown) rather than guessing.
 */
class CloudflareZonesClient
{
    private const TIMEOUT_SECONDS = 15;

    /**
     * @return string|null 'cloudflare' if a matching zone exists, null if
     *                     lookup is disabled, not found, or the call fails.
     */
    public function dnsProviderFor(string $domainName): ?string
    {
        if (! (bool) config('services.cloudflare.zones_lookup_enabled')) {
            return null;
        }

        $reference = (string) Str::uuid();
        $accountId = (string) config('services.cloudflare.account_id');

        try {
            $response = Http::withToken((string) config('services.cloudflare.registrar_api_token'))
                ->acceptJson()
                ->baseUrl(rtrim((string) config('services.cloudflare.base_url'), '/'))
                ->timeout(self::TIMEOUT_SECONDS)
                ->get('/zones', ['name' => $domainName, 'account.id' => $accountId]);
        } catch (\Throwable $exception) {
            $this->log($reference, 'error', null, $exception->getMessage());

            return null;
        }

        if ($response->failed() || $response->json('success') === false) {
            $this->log($reference, 'failed', $response->status());

            return null;
        }

        $zones = $response->json('result') ?? [];
        $this->log($reference, 'success', $response->status());

        return count($zones) > 0 ? 'cloudflare' : null;
    }

    private function log(string $reference, string $status, ?int $responseCode, ?string $error = null): void
    {
        $now = now();

        DomainSyncLog::query()->create([
            'domain_id' => null,
            'provider' => 'cloudflare',
            'action' => 'zones_lookup',
            'status' => $status,
            'request_reference' => $reference,
            'response_code' => $responseCode,
            'error_message' => $error,
            'started_at' => $now,
            'completed_at' => $now,
        ]);
    }
}
