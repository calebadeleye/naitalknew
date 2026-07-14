<?php

namespace App\Services\Domains\Registrars;

use App\Services\Domains\Registrars\Data\DomainAvailabilityResult;
use App\Services\Domains\Registrars\Data\DomainOperationResult;
use App\Services\Domains\Registrars\Data\DomainRegistrationData;
use App\Services\Domains\Registrars\Data\DomainSearchResult;
use App\Services\Domains\Registrars\Data\DomainTransferData;
use App\Services\Domains\Registrars\Data\RegistrarDomainResult;
use App\Services\Domains\Registrars\Data\RegistrarRegistrationPage;

/**
 * The provider-independent registrar contract. Every registrar (Spaceship,
 * Cloudflare, and any future provider) implements this so callers — the
 * sync command/job, the renewal pipeline, admin actions — never need to
 * know which registrar a given domain actually uses.
 *
 * NOTE on current scope: `register()` and `search()` are implemented by
 * every adapter for architectural completeness, but nothing in this phase
 * wires them into the live checkout/search flow — new customer domain
 * purchases continue through the existing Spaceship-only DomainOrderService/
 * DomainSearchController path unchanged. These methods exist so a future
 * checkout integration doesn't require another interface redesign.
 */
interface DomainRegistrarInterface
{
    public function providerName(): string;

    public function listRegistrations(?string $cursor = null, int $perPage = 50): RegistrarRegistrationPage;

    public function getRegistration(string $domainName): ?RegistrarDomainResult;

    public function search(string $domainName): DomainSearchResult;

    public function checkAvailability(string $domainName): DomainAvailabilityResult;

    public function register(DomainRegistrationData $data): DomainOperationResult;

    public function renew(string $domainName, int $years = 1): DomainOperationResult;

    public function transfer(DomainTransferData $data): DomainOperationResult;

    public function getTransferStatus(string $domainName): DomainOperationResult;

    public function getAutoRenew(string $domainName): bool;

    public function setAutoRenew(string $domainName, bool $enabled): DomainOperationResult;
}
