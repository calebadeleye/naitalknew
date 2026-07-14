<?php

namespace App\Services\Domains\Registrars;

use App\Exceptions\CloudflareApiException;
use App\Services\Domains\Registrars\Data\DomainAvailabilityResult;
use App\Services\Domains\Registrars\Data\DomainOperationResult;
use App\Services\Domains\Registrars\Data\DomainOperationStatus;
use App\Services\Domains\Registrars\Data\DomainRegistrationData;
use App\Services\Domains\Registrars\Data\DomainSearchResult;
use App\Services\Domains\Registrars\Data\DomainTransferData;
use App\Services\Domains\Registrars\Data\RegistrarDomainResult;
use App\Services\Domains\Registrars\Data\RegistrarRegistrationPage;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Normalizes Cloudflare's raw Registrar API JSON into the provider-agnostic
 * DTOs, defensively handling malformed responses, missing domains, pending
 * transfers, and unsupported TLDs — never a hard crash on unexpected shape.
 */
class CloudflareRegistrarService implements DomainRegistrarInterface
{
    public function __construct(private readonly CloudflareRegistrarClient $client) {}

    public function providerName(): string
    {
        return 'cloudflare';
    }

    public function listRegistrations(?string $cursor = null, int $perPage = 50): RegistrarRegistrationPage
    {
        try {
            $page = $this->client->listRegistrations($cursor, $perPage);
        } catch (Throwable $exception) {
            throw $exception instanceof CloudflareApiException
                ? $exception
                : new CloudflareApiException('Failed to list Cloudflare registrations.', previous: $exception);
        }

        $items = array_values(array_filter(array_map(
            fn (array $item) => $this->normalizeDomainResult($item),
            $page['items'] ?? [],
        )));

        return new RegistrarRegistrationPage(
            items: $items,
            nextCursor: $page['has_more'] ? (string) ($page['page'] + 1) : null,
            hasMore: $page['has_more'],
            totalCount: $page['total_count'],
        );
    }

    public function getRegistration(string $domainName): ?RegistrarDomainResult
    {
        try {
            $raw = $this->client->getRegistration($domainName);
        } catch (Throwable $exception) {
            throw $exception instanceof CloudflareApiException
                ? $exception
                : new CloudflareApiException("Failed to fetch Cloudflare registration for {$domainName}.", previous: $exception);
        }

        if (! $raw) {
            return null;
        }

        return $this->normalizeDomainResult($raw);
    }

    /**
     * Not wired into any live search/checkout path in this phase — Cloudflare
     * Registrar has no distinct "search for a new domain" concept separate
     * from checking a single name's availability, so this defers entirely
     * to checkAvailability().
     */
    public function search(string $domainName): DomainSearchResult
    {
        $primary = $this->checkAvailability($domainName);

        return new DomainSearchResult(domain: $domainName, primary: $primary, suggestions: []);
    }

    public function checkAvailability(string $domainName): DomainAvailabilityResult
    {
        try {
            $raw = $this->client->getRegistration($domainName);
        } catch (Throwable) {
            // A failed lookup is not the same as "unavailable" — surface it
            // as unsupported rather than fabricating an availability answer.
            return new DomainAvailabilityResult(
                domain: $domainName,
                available: false,
                premium: false,
                tldSupported: false,
            );
        }

        if ($raw === null) {
            return new DomainAvailabilityResult(domain: $domainName, available: true, premium: false, tldSupported: true);
        }

        return new DomainAvailabilityResult(
            domain: $domainName,
            available: (bool) ($raw['available'] ?? false),
            premium: false,
            tldSupported: (bool) ($raw['can_register'] ?? true),
            raw: $raw,
        );
    }

    /**
     * Cloudflare Registrar historically supports transfer-in rather than
     * fresh new-name registration for most TLDs — see the class docblock on
     * CloudflareRegistrarClient. Not called from any live checkout path in
     * this phase regardless (see DomainRegistrarInterface's class docblock).
     */
    public function register(DomainRegistrationData $data): DomainOperationResult
    {
        return new DomainOperationResult(
            successful: false,
            status: DomainOperationStatus::RequiresAttention,
            errorMessage: 'Direct new-name registration through Cloudflare Registrar is not wired up in this phase — use transfer() for domains already registered elsewhere, or import already-registered Cloudflare domains via the sync command.',
        );
    }

    public function renew(string $domainName, int $years = 1): DomainOperationResult
    {
        try {
            $result = $this->client->renewDomain($domainName, $years);
        } catch (Throwable $exception) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: $exception->getMessage(),
            );
        }

        $newExpiresAt = isset($result['expires_at']) ? $this->parseDate($result['expires_at']) : null;

        return new DomainOperationResult(
            successful: true,
            // Cloudflare's renewal may not complete synchronously — treat it
            // as Pending until a follow-up sync confirms the new expiry
            // date, per the "paid invoice != renewed domain" requirement.
            status: DomainOperationStatus::Pending,
            newExpiresAt: $newExpiresAt,
            raw: $result,
        );
    }

    public function transfer(DomainTransferData $data): DomainOperationResult
    {
        try {
            $result = $this->client->initiateTransfer($data->domainName, $data->eppCode, $data->contacts);
        } catch (Throwable $exception) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: $exception->getMessage(),
            );
        }

        return new DomainOperationResult(
            successful: true,
            status: DomainOperationStatus::Pending,
            raw: $result,
        );
    }

    public function getTransferStatus(string $domainName): DomainOperationResult
    {
        try {
            $raw = $this->client->getRegistration($domainName);
        } catch (Throwable $exception) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: $exception->getMessage(),
            );
        }

        $transferStatus = $raw['transfer_in']['status'] ?? null;

        $status = match ($transferStatus) {
            'completed' => DomainOperationStatus::Completed,
            'cancelled', 'rejected' => DomainOperationStatus::Failed,
            'pending', 'pending_owner', 'pending_authorization' => DomainOperationStatus::Pending,
            default => DomainOperationStatus::RequiresAttention,
        };

        return new DomainOperationResult(successful: $status === DomainOperationStatus::Completed, status: $status, raw: $raw ?? []);
    }

    public function getAutoRenew(string $domainName): bool
    {
        try {
            $raw = $this->client->getRegistration($domainName);
        } catch (Throwable) {
            return false;
        }

        return (bool) ($raw['auto_renew'] ?? false);
    }

    public function setAutoRenew(string $domainName, bool $enabled): DomainOperationResult
    {
        try {
            $result = $this->client->setAutoRenew($domainName, $enabled);
        } catch (Throwable $exception) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: $exception->getMessage(),
            );
        }

        // Confirmed synchronously by Cloudflare's response, but callers
        // should still only trust the LOCAL auto_renew column after a
        // follow-up sync re-reads it — see RenewalCompletionDetector (Stage 4).
        return new DomainOperationResult(
            successful: ((bool) ($result['auto_renew'] ?? $enabled)) === $enabled,
            status: DomainOperationStatus::Pending,
            raw: $result,
        );
    }

    /**
     * @param  array<string, mixed>  $raw
     */
    private function normalizeDomainResult(array $raw): ?RegistrarDomainResult
    {
        // `name` (the actual domain name) is mandatory on every real
        // Cloudflare registrar domain object — a record missing it is
        // malformed and must be skipped, not silently keyed by an opaque
        // `id` that isn't a domain name at all.
        $domainName = (string) ($raw['name'] ?? '');

        if ($domainName === '') {
            return null;
        }

        return new RegistrarDomainResult(
            providerDomainId: (string) ($raw['id'] ?? $domainName),
            providerOrderId: isset($raw['registry_statuses']) ? (string) ($raw['id'] ?? $domainName) : null,
            domainName: $domainName,
            tld: $this->extractTld($domainName),
            providerStatus: (string) ($raw['registry_statuses'] ?? $raw['status'] ?? 'unknown'),
            autoRenewEnabled: (bool) ($raw['auto_renew'] ?? false),
            registeredAt: isset($raw['created_at']) ? $this->parseDate($raw['created_at']) : null,
            expiresAt: isset($raw['expires_at']) ? $this->parseDate($raw['expires_at']) : null,
            nameservers: isset($raw['name_servers']) && is_array($raw['name_servers']) ? array_values($raw['name_servers']) : null,
            dnsStatus: null,
            providerCostMinor: null,
            providerCurrency: null,
            providerMetadata: $this->sanitizeMetadata($raw),
        );
    }

    /**
     * Never includes registrant/contact fields — a hard privacy boundary,
     * not just a convenience omission.
     *
     * @param  array<string, mixed>  $raw
     * @return array<string, mixed>
     */
    private function sanitizeMetadata(array $raw): array
    {
        $blocked = ['contacts', 'registrant_contact', 'admin_contact', 'tech_contact', 'billing_contact', 'auth_code'];

        return collect($raw)->reject(fn ($value, $key) => in_array($key, $blocked, true))->all();
    }

    private function parseDate(string $value): ?\DateTimeImmutable
    {
        try {
            return Carbon::parse($value)->toDateTimeImmutable();
        } catch (Throwable) {
            return null;
        }
    }

    private function extractTld(string $domain): string
    {
        $parts = explode('.', $domain);
        array_shift($parts);

        return '.'.implode('.', $parts);
    }
}
