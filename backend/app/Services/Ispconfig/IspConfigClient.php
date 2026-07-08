<?php

namespace App\Services\Ispconfig;

use App\Services\Ispconfig\Exceptions\IspConfigApiException;

/**
 * Contract for talking to ISPConfig's Remote API. All methods throw
 * IspConfigApiException on failure — implementations must never return
 * placeholder/fake data on error.
 */
interface IspConfigClient
{
    /**
     * @throws IspConfigApiException
     */
    public function login(): string;

    public function logout(string $sessionId): void;

    /**
     * @param  array<string, mixed>  $params
     *
     * @throws IspConfigApiException
     */
    public function clientAdd(string $sessionId, int $resellerId, array $params): int;

    /**
     * @return array<string, mixed>|null
     */
    public function clientGet(string $sessionId, int $clientId): ?array;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function clientList(string $sessionId): array;

    /**
     * @param  array<string, mixed>  $params
     */
    public function sitesWebDomainAdd(string $sessionId, int $clientId, array $params): int;

    /**
     * @return array<string, mixed>|null
     */
    public function sitesWebDomainGet(string $sessionId, int $domainId): ?array;

    public function sitesWebDomainDelete(string $sessionId, int $domainId): int;

    /**
     * ISPConfig requires a mail domain to exist before any mailbox can be
     * created under it — this is separate from the website/vhost record.
     *
     * @param  array<string, mixed>  $params
     */
    public function mailDomainAdd(string $sessionId, int $clientId, array $params): int;

    /**
     * @return array<string, mixed>|null
     */
    public function mailDomainGet(string $sessionId, int $mailDomainId): ?array;

    /**
     * @param  array<string, mixed>  $params
     */
    public function mailUserAdd(string $sessionId, int $clientId, array $params): int;

    /**
     * @param  array<string, mixed>  $params
     */
    public function mailUserUpdate(string $sessionId, int $clientId, int $mailUserId, array $params): int;

    public function mailUserDelete(string $sessionId, int $mailUserId): int;

    /**
     * @return array<string, mixed>|null
     */
    public function mailUserGet(string $sessionId, int $mailUserId): ?array;

    /**
     * @param  array<string, mixed>  $params
     */
    public function databasesDatabaseAdd(string $sessionId, int $clientId, array $params): int;

    public function databasesDatabaseDelete(string $sessionId, int $databaseId): int;

    public function databasesDatabaseUserDelete(string $sessionId, int $databaseUserId): int;

    /**
     * @return array<string, mixed>|null
     */
    public function databasesDatabaseGet(string $sessionId, int $databaseId): ?array;

    /**
     * @param  array<string, mixed>  $params
     */
    public function databasesDatabaseUserAdd(string $sessionId, int $clientId, array $params): int;

    /**
     * @param  array<string, mixed>  $params
     */
    public function databasesDatabaseUserUpdate(string $sessionId, int $clientId, int $userId, array $params): int;

    /**
     * @param  array<string, mixed>  $params
     */
    public function ftpUserAdd(string $sessionId, int $clientId, array $params): int;

    /**
     * @param  array<string, mixed>  $params
     */
    public function ftpUserUpdate(string $sessionId, int $clientId, int $ftpUserId, array $params): int;

    public function ftpUserDelete(string $sessionId, int $ftpUserId): int;

    /**
     * @return array<string, mixed>|null
     */
    public function ftpUserGet(string $sessionId, int $ftpUserId): ?array;

    /**
     * @return array<string, mixed>
     */
    public function clientGetTrafficUsage(string $sessionId, int $clientId): array;

    /**
     * @return array<string, mixed>
     */
    public function sitesWebDomainGetTrafficUsage(string $sessionId, int $domainId): array;
}
