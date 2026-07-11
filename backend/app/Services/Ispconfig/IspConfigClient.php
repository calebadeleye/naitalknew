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
     * Read-only listing, used only by the legacy ISPConfig import (never by
     * provisioning). Pass a filter (e.g. ['client_id' => 5]) to scope
     * results; an empty filter returns every website ISPConfig knows about.
     *
     * @param  array<string, mixed>  $filter
     * @return array<int, array<string, mixed>>
     */
    public function sitesWebDomainList(string $sessionId, array $filter = []): array;

    /**
     * @param  array<string, mixed>  $filter
     * @return array<int, array<string, mixed>>
     */
    public function mailDomainList(string $sessionId, array $filter = []): array;

    /**
     * @param  array<string, mixed>  $filter
     * @return array<int, array<string, mixed>>
     */
    public function mailUserList(string $sessionId, array $filter = []): array;

    /**
     * Email aliases/forwarders. Not every ISPConfig install exposes this
     * remote method — implementations must return an empty array rather
     * than throw when it's unavailable.
     *
     * @param  array<string, mixed>  $filter
     * @return array<int, array<string, mixed>>
     */
    public function mailAliasList(string $sessionId, array $filter = []): array;

    /**
     * @param  array<string, mixed>  $filter
     * @return array<int, array<string, mixed>>
     */
    public function databasesDatabaseList(string $sessionId, array $filter = []): array;

    /**
     * DNS zones. Optional — implementations must return an empty array
     * rather than throw when it's unavailable.
     *
     * @param  array<string, mixed>  $filter
     * @return array<int, array<string, mixed>>
     */
    public function dnsZoneList(string $sessionId, array $filter = []): array;

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
     * Updates an existing website record — used to flip ISPConfig's own
     * 'active' flag ('y'/'n') for deactivate/reactivate, and available for
     * any other website field an admin action needs to change in place.
     * Never used to create a new website.
     *
     * @param  array<string, mixed>  $params
     */
    public function sitesWebDomainUpdate(string $sessionId, int $clientId, int $domainId, array $params): int;

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
     * Shell users are ISPConfig's real SSH/SFTP accounts (a system user with
     * an actual login shell, confined to the website's document root) — the
     * mechanism confirmed working on our server, unlike PureFTPd FTP users.
     *
     * @param  array<string, mixed>  $params
     */
    public function shellUserAdd(string $sessionId, int $clientId, array $params): int;

    /**
     * @param  array<string, mixed>  $params
     */
    public function shellUserUpdate(string $sessionId, int $clientId, int $shellUserId, array $params): int;

    public function shellUserDelete(string $sessionId, int $shellUserId): int;

    /**
     * @return array<string, mixed>|null
     */
    public function shellUserGet(string $sessionId, int $shellUserId): ?array;

    /**
     * @return array<string, mixed>
     */
    public function clientGetTrafficUsage(string $sessionId, int $clientId): array;

    /**
     * @return array<string, mixed>
     */
    public function sitesWebDomainGetTrafficUsage(string $sessionId, int $domainId): array;
}
