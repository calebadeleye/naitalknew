<?php

namespace App\Services\Domains\Registrars;

use App\Models\Domain;
use App\Services\Domains\Registrars\Data\DomainAvailabilityResult;
use App\Services\Domains\Registrars\Data\DomainOperationResult;
use App\Services\Domains\Registrars\Data\DomainOperationStatus;
use App\Services\Domains\Registrars\Data\DomainRegistrationData;
use App\Services\Domains\Registrars\Data\DomainSearchResult;
use App\Services\Domains\Registrars\Data\DomainTransferData;
use App\Services\Domains\Registrars\Data\RegistrarDomainResult;
use App\Services\Domains\Registrars\Data\RegistrarRegistrationPage;
use App\Services\Domains\SpaceshipClient;
use App\Services\Domains\SpaceshipDomainAvailabilityService;
use App\Services\Domains\SpaceshipDomainRenewalService;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Wraps the existing, unmodified Spaceship services to satisfy
 * DomainRegistrarInterface — every other Spaceship call site (checkout,
 * DomainSearchController, InitiateDomainTransferJob, SyncDomainStatusJob)
 * keeps calling those services directly exactly as before; this adapter
 * exists only for the new generalized call sites (RegistrarResolver-based
 * renewal, future sync/auto-renew work) that need a provider-agnostic
 * contract.
 */
class SpaceshipRegistrarAdapter implements DomainRegistrarInterface
{
    public function __construct(
        private readonly SpaceshipClient $client,
        private readonly SpaceshipDomainAvailabilityService $availability,
        private readonly SpaceshipDomainRenewalService $renewalService,
    ) {}

    public function providerName(): string
    {
        return 'spaceship';
    }

    /**
     * Spaceship has no bulk registrations-list endpoint (registration here
     * is manual by design — see DomainOrderDispatcher) — there is nothing to
     * sync in bulk, so this always returns an empty, exhausted page rather
     * than throwing, since the interface contract must always be safely
     * callable even for providers that don't support this operation.
     */
    public function listRegistrations(?string $cursor = null, int $perPage = 50): RegistrarRegistrationPage
    {
        return new RegistrarRegistrationPage(items: [], nextCursor: null, hasMore: false, totalCount: 0);
    }

    public function getRegistration(string $domainName): ?RegistrarDomainResult
    {
        try {
            $info = $this->client->getDomainInfo($domainName);
        } catch (Throwable) {
            return null;
        }

        if (empty($info)) {
            return null;
        }

        return new RegistrarDomainResult(
            providerDomainId: (string) ($info['id'] ?? $domainName),
            providerOrderId: null,
            domainName: $domainName,
            tld: $this->extractTld($domainName),
            providerStatus: (string) ($info['status'] ?? 'unknown'),
            autoRenewEnabled: (bool) ($info['autoRenew'] ?? true),
            registeredAt: null,
            expiresAt: null,
            nameservers: null,
            dnsStatus: null,
            providerCostMinor: null,
            providerCurrency: null,
            providerMetadata: [],
        );
    }

    public function search(string $domainName): DomainSearchResult
    {
        $result = $this->availability->search($domainName);

        $primary = new DomainAvailabilityResult(
            domain: $result['domain'],
            available: $result['available'],
            premium: $result['premium'],
            tldSupported: $result['tld_supported'],
            premiumPriceMinor: null,
            currency: $result['currency'] ?? null,
            raw: $result,
        );

        $suggestions = array_map(fn (array $suggestion) => new DomainAvailabilityResult(
            domain: $suggestion['domain'],
            available: true,
            premium: false,
            tldSupported: true,
            raw: $suggestion,
        ), $result['suggestions'] ?? []);

        return new DomainSearchResult(domain: $result['domain'], primary: $primary, suggestions: $suggestions);
    }

    public function checkAvailability(string $domainName): DomainAvailabilityResult
    {
        $result = $this->client->checkAvailability($domainName);

        return new DomainAvailabilityResult(
            domain: $result['domain'],
            available: $result['available'],
            premium: $result['premium'],
            tldSupported: $result['tld_supported'],
            raw: $result,
        );
    }

    /**
     * Never called in this phase — Spaceship registration stays manual via
     * the existing DomainOrderDispatcher/Admin\DomainController::markRegistered
     * flow. Implemented defensively (rather than throwing) so an accidental
     * future call gets a clear, actionable result instead of a crash.
     */
    public function register(DomainRegistrationData $data): DomainOperationResult
    {
        return new DomainOperationResult(
            successful: false,
            status: DomainOperationStatus::RequiresAttention,
            errorMessage: 'Spaceship registration is manual by design — use the admin "mark registered" workflow instead of this interface method.',
        );
    }

    public function renew(string $domainName, int $years = 1): DomainOperationResult
    {
        $domain = Domain::query()->where('domain_name', $domainName)->first();

        if (! $domain) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: "No local domain record found for {$domainName}.",
            );
        }

        try {
            $this->renewalService->renew($domain, $years);
        } catch (Throwable $exception) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: $exception->getMessage(),
            );
        }

        return new DomainOperationResult(
            successful: true,
            status: DomainOperationStatus::Completed,
            newExpiresAt: $domain->fresh()->expires_at ? Carbon::parse($domain->fresh()->expires_at)->toDateTimeImmutable() : null,
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
            providerOperationId: $result['operation_id'] ?? null,
            raw: $result['raw'] ?? [],
        );
    }

    public function getTransferStatus(string $domainName): DomainOperationResult
    {
        try {
            $result = $this->client->getTransferStatus($domainName);
        } catch (Throwable $exception) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: $exception->getMessage(),
            );
        }

        $status = match ($result['status'] ?? null) {
            'completed', 'success' => DomainOperationStatus::Completed,
            'failed', 'cancelled' => DomainOperationStatus::Failed,
            default => DomainOperationStatus::Pending,
        };

        return new DomainOperationResult(successful: $status === DomainOperationStatus::Completed, status: $status, raw: $result);
    }

    /**
     * Spaceship auto-renew was never wired to a live call in this codebase —
     * this reads the local Domain.auto_renew column directly, preserving
     * today's exact behavior.
     */
    public function getAutoRenew(string $domainName): bool
    {
        return (bool) (Domain::query()->where('domain_name', $domainName)->value('auto_renew') ?? true);
    }

    /**
     * Same rationale as getAutoRenew() — immediate local flip, no registrar
     * call, exactly matching existing behavior for Spaceship domains.
     */
    public function setAutoRenew(string $domainName, bool $enabled): DomainOperationResult
    {
        $domain = Domain::query()->where('domain_name', $domainName)->first();

        if (! $domain) {
            return new DomainOperationResult(
                successful: false,
                status: DomainOperationStatus::Failed,
                errorMessage: "No local domain record found for {$domainName}.",
            );
        }

        $domain->forceFill(['auto_renew' => $enabled])->save();

        return new DomainOperationResult(successful: true, status: DomainOperationStatus::Completed);
    }

    private function extractTld(string $domain): string
    {
        $parts = explode('.', $domain);
        array_shift($parts);

        return '.'.implode('.', $parts);
    }
}
