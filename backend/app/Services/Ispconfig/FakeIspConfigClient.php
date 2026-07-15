<?php

namespace App\Services\Ispconfig;

use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use Throwable;

/**
 * In-memory test double for IspConfigClient. Never makes network calls.
 * Tests can call shouldFail() to make a specific method throw once.
 */
class FakeIspConfigClient implements IspConfigClient
{
    private int $nextId = 1;

    /** @var array<string, array<string, mixed>> */
    private array $clients = [];

    /** @var array<string, array<string, mixed>> */
    private array $domains = [];

    /** @var array<string, array<string, mixed>> */
    private array $mailDomains = [];

    /** @var array<string, array<string, mixed>> */
    private array $mailUsers = [];

    /** @var array<string, array<string, mixed>> */
    private array $databases = [];

    /** @var array<string, array<string, mixed>> */
    private array $ftpUsers = [];

    /** @var array<string, array<string, mixed>> */
    private array $shellUsers = [];

    /** @var array<string, Throwable> */
    private array $failures = [];

    /** @var array<int, array{method: string, params: array<string, mixed>}> */
    public array $calls = [];

    public function shouldFail(string $method, Throwable $exception): void
    {
        $this->failures[$method] = $exception;
    }

    private function maybeFail(string $method, array $params = []): void
    {
        $this->calls[] = ['method' => $method, 'params' => $params];

        if (isset($this->failures[$method])) {
            $exception = $this->failures[$method];
            unset($this->failures[$method]);

            throw $exception;
        }
    }

    public function login(): string
    {
        $this->maybeFail('login');

        return 'fake-session-'.bin2hex(random_bytes(8));
    }

    public function logout(string $sessionId): void
    {
        $this->maybeFail('logout', ['session_id' => $sessionId]);
    }

    public function clientAdd(string $sessionId, int $resellerId, array $params): int
    {
        $this->maybeFail('clientAdd', $params);

        $id = $this->nextId++;
        $this->clients[(string) $id] = array_merge($params, ['client_id' => $id]);

        return $id;
    }

    public function clientGet(string $sessionId, int $clientId): ?array
    {
        $this->maybeFail('clientGet', ['client_id' => $clientId]);

        return $this->clients[(string) $clientId] ?? null;
    }

    public function clientList(string $sessionId): array
    {
        $this->maybeFail('clientList');

        return array_values($this->clients);
    }

    /**
     * @param  array<string, mixed>  $filter
     * @return array<int, array<string, mixed>>
     */
    private function filtered(array $records, array $filter): array
    {
        if ($filter === []) {
            return array_values($records);
        }

        return array_values(array_filter($records, function (array $record) use ($filter): bool {
            foreach ($filter as $key => $value) {
                if (! array_key_exists($key, $record) || (string) $record[$key] !== (string) $value) {
                    return false;
                }
            }

            return true;
        }));
    }

    public function sitesWebDomainList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('sitesWebDomainList', $filter);

        return $this->filtered($this->domains, $filter);
    }

    public function mailDomainList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('mailDomainList', $filter);

        return $this->filtered($this->mailDomains, $filter);
    }

    public function mailUserList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('mailUserList', $filter);

        return $this->filtered($this->mailUsers, $filter);
    }

    public function mailAliasList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('mailAliasList', $filter);

        // No fake backing store — real ISPConfig installs may not expose
        // this either, so the fake mirrors that "always empty" behaviour.
        return [];
    }

    public function databasesDatabaseList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('databasesDatabaseList', $filter);

        return $this->filtered($this->databases, $filter);
    }

    public function dnsZoneList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('dnsZoneList', $filter);

        return [];
    }

    public function sitesWebDomainAdd(string $sessionId, int $clientId, array $params): int
    {
        $this->maybeFail('sitesWebDomainAdd', $params);

        $id = $this->nextId++;
        $this->domains[(string) $id] = array_merge([
            'system_user' => 'web'.$id,
            'system_group' => 'client'.$clientId,
            'document_root' => '/var/www/clients/client'.$clientId.'/web'.$id,
        ], $params, ['domain_id' => $id, 'client_id' => $clientId, 'sys_groupid' => $clientId + 1]);

        return $id;
    }

    public function sitesWebDomainGet(string $sessionId, int $domainId): ?array
    {
        $this->maybeFail('sitesWebDomainGet', ['domain_id' => $domainId]);

        return $this->domains[(string) $domainId] ?? null;
    }

    public function sitesWebDomainDelete(string $sessionId, int $domainId): int
    {
        $this->maybeFail('sitesWebDomainDelete', ['domain_id' => $domainId]);

        unset($this->domains[(string) $domainId]);

        return $domainId;
    }

    public function sitesWebDomainUpdate(string $sessionId, int $clientId, int $domainId, array $params): int
    {
        $this->maybeFail('sitesWebDomainUpdate', $params);

        if (! isset($this->domains[(string) $domainId])) {
            throw new IspConfigApiException("website {$domainId} not found", ['method' => 'sitesWebDomainUpdate']);
        }

        $this->domains[(string) $domainId] = array_merge($this->domains[(string) $domainId], $params);

        return $domainId;
    }

    public function mailDomainAdd(string $sessionId, int $clientId, array $params): int
    {
        $this->maybeFail('mailDomainAdd', $params);

        $id = $this->nextId++;
        $this->mailDomains[(string) $id] = array_merge($params, ['mail_domain_id' => $id, 'domain_id' => $id, 'client_id' => $clientId, 'sys_groupid' => $clientId + 1]);

        return $id;
    }

    public function mailDomainGet(string $sessionId, int $mailDomainId): ?array
    {
        $this->maybeFail('mailDomainGet', ['mail_domain_id' => $mailDomainId]);

        return $this->mailDomains[(string) $mailDomainId] ?? null;
    }

    public function mailUserAdd(string $sessionId, int $clientId, array $params): int
    {
        $this->maybeFail('mailUserAdd', $params);

        $id = $this->nextId++;
        $this->mailUsers[(string) $id] = array_merge($params, ['mailuser_id' => $id, 'client_id' => $clientId, 'sys_groupid' => $clientId + 1]);

        return $id;
    }

    public function mailUserUpdate(string $sessionId, int $clientId, int $mailUserId, array $params): int
    {
        $this->maybeFail('mailUserUpdate', $params);

        if (! isset($this->mailUsers[(string) $mailUserId])) {
            throw new IspConfigApiException("mail user {$mailUserId} not found", ['method' => 'mailUserUpdate']);
        }

        $this->mailUsers[(string) $mailUserId] = array_merge($this->mailUsers[(string) $mailUserId], $params);

        return $mailUserId;
    }

    public function mailUserDelete(string $sessionId, int $mailUserId): int
    {
        $this->maybeFail('mailUserDelete', ['mailuser_id' => $mailUserId]);

        unset($this->mailUsers[(string) $mailUserId]);

        return $mailUserId;
    }

    public function mailUserGet(string $sessionId, int $mailUserId): ?array
    {
        $this->maybeFail('mailUserGet', ['mailuser_id' => $mailUserId]);

        return $this->mailUsers[(string) $mailUserId] ?? null;
    }

    public function databasesDatabaseAdd(string $sessionId, int $clientId, array $params): int
    {
        $this->maybeFail('databasesDatabaseAdd', $params);

        $id = $this->nextId++;
        $this->databases[(string) $id] = array_merge($params, ['database_id' => $id, 'client_id' => $clientId, 'sys_groupid' => $clientId + 1]);

        return $id;
    }

    public function databasesDatabaseDelete(string $sessionId, int $databaseId): int
    {
        $this->maybeFail('databasesDatabaseDelete', ['database_id' => $databaseId]);

        unset($this->databases[(string) $databaseId]);

        return $databaseId;
    }

    public function databasesDatabaseUserDelete(string $sessionId, int $databaseUserId): int
    {
        $this->maybeFail('databasesDatabaseUserDelete', ['database_user_id' => $databaseUserId]);

        return $databaseUserId;
    }

    public function databasesDatabaseGet(string $sessionId, int $databaseId): ?array
    {
        $this->maybeFail('databasesDatabaseGet', ['database_id' => $databaseId]);

        return $this->databases[(string) $databaseId] ?? null;
    }

    public function databasesDatabaseUserAdd(string $sessionId, int $clientId, array $params): int
    {
        $this->maybeFail('databasesDatabaseUserAdd', $params);

        return $this->nextId++;
    }

    public function databasesDatabaseUserUpdate(string $sessionId, int $clientId, int $userId, array $params): int
    {
        $this->maybeFail('databasesDatabaseUserUpdate', $params);

        return $userId;
    }

    public function ftpUserAdd(string $sessionId, int $clientId, array $params): int
    {
        $this->maybeFail('ftpUserAdd', $params);

        $id = $this->nextId++;
        $this->ftpUsers[(string) $id] = array_merge($params, ['ftp_user_id' => $id, 'client_id' => $clientId, 'sys_groupid' => $clientId + 1]);

        return $id;
    }

    public function ftpUserUpdate(string $sessionId, int $clientId, int $ftpUserId, array $params): int
    {
        $this->maybeFail('ftpUserUpdate', $params);

        if (! isset($this->ftpUsers[(string) $ftpUserId])) {
            throw new IspConfigApiException("ftp user {$ftpUserId} not found", ['method' => 'ftpUserUpdate']);
        }

        $this->ftpUsers[(string) $ftpUserId] = array_merge($this->ftpUsers[(string) $ftpUserId], $params);

        return $ftpUserId;
    }

    public function ftpUserDelete(string $sessionId, int $ftpUserId): int
    {
        $this->maybeFail('ftpUserDelete', ['ftp_user_id' => $ftpUserId]);

        unset($this->ftpUsers[(string) $ftpUserId]);

        return $ftpUserId;
    }

    public function ftpUserGet(string $sessionId, int $ftpUserId): ?array
    {
        $this->maybeFail('ftpUserGet', ['ftp_user_id' => $ftpUserId]);

        return $this->ftpUsers[(string) $ftpUserId] ?? null;
    }

    public function ftpUserList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('ftpUserList', $filter);

        return $this->filtered($this->ftpUsers, $filter);
    }

    public function shellUserAdd(string $sessionId, int $clientId, array $params): int
    {
        $this->maybeFail('shellUserAdd', $params);

        $id = $this->nextId++;
        $this->shellUsers[(string) $id] = array_merge($params, ['shell_user_id' => $id, 'client_id' => $clientId, 'sys_groupid' => $clientId + 1]);

        return $id;
    }

    public function shellUserUpdate(string $sessionId, int $clientId, int $shellUserId, array $params): int
    {
        $this->maybeFail('shellUserUpdate', $params);

        if (! isset($this->shellUsers[(string) $shellUserId])) {
            throw new IspConfigApiException("shell user {$shellUserId} not found", ['method' => 'shellUserUpdate']);
        }

        $this->shellUsers[(string) $shellUserId] = array_merge($this->shellUsers[(string) $shellUserId], $params);

        return $shellUserId;
    }

    public function shellUserDelete(string $sessionId, int $shellUserId): int
    {
        $this->maybeFail('shellUserDelete', ['shell_user_id' => $shellUserId]);

        unset($this->shellUsers[(string) $shellUserId]);

        return $shellUserId;
    }

    public function shellUserGet(string $sessionId, int $shellUserId): ?array
    {
        $this->maybeFail('shellUserGet', ['shell_user_id' => $shellUserId]);

        return $this->shellUsers[(string) $shellUserId] ?? null;
    }

    public function shellUserList(string $sessionId, array $filter = []): array
    {
        $this->maybeFail('shellUserList', $filter);

        return $this->filtered($this->shellUsers, $filter);
    }

    public function clientGetTrafficUsage(string $sessionId, int $clientId): array
    {
        $this->maybeFail('clientGetTrafficUsage', ['client_id' => $clientId]);

        return ['traffic_bytes' => 0];
    }

    public function sitesWebDomainGetTrafficUsage(string $sessionId, int $domainId): array
    {
        $this->maybeFail('sitesWebDomainGetTrafficUsage', ['domain_id' => $domainId]);

        return ['traffic_bytes' => 0, 'disk_bytes' => 0];
    }
}
