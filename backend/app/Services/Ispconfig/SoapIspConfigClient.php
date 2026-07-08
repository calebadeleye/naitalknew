<?php

namespace App\Services\Ispconfig;

use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use SoapClient;
use SoapFault;
use Throwable;

/**
 * Real ISPConfig Remote API client using PHP's SoapClient in NON-WSDL mode.
 * ISPConfig's remote/index.php does not support WSDL auto-generation
 * ("WSDL generation is not supported yet" SOAP fault on ?wsdl) — the
 * documented integration path is a non-WSDL SoapClient constructed with
 * explicit location/uri options instead. One login() per instance
 * lifetime — callers should construct this per-job/per-request, not share
 * it across unrelated requests.
 */
class SoapIspConfigClient implements IspConfigClient
{
    private ?SoapClient $client = null;

    public function __construct(
        private readonly ?string $host,
        private readonly int $port,
        private readonly ?string $remoteUser,
        private readonly ?string $remotePassword,
        private readonly bool $verifySsl = true,
    ) {
    }

    private function client(): SoapClient
    {
        if ($this->client instanceof SoapClient) {
            return $this->client;
        }

        if (! $this->host || ! $this->remoteUser || ! $this->remotePassword) {
            throw new IspConfigApiException(
                'ISPConfig is not configured: ISPCONFIG_HOST, ISPCONFIG_REMOTE_USER, and ISPCONFIG_REMOTE_PASSWORD must be set in .env.',
                ['method' => 'client_bootstrap'],
            );
        }

        $endpoint = "https://{$this->host}:{$this->port}/remote/index.php";

        $streamContext = stream_context_create([
            'ssl' => [
                'verify_peer' => $this->verifySsl,
                'verify_peer_name' => $this->verifySsl,
                'allow_self_signed' => ! $this->verifySsl,
            ],
        ]);

        try {
            $this->client = new SoapClient(null, [
                'location' => $endpoint,
                'uri' => "https://{$this->host}:{$this->port}/remote/",
                'stream_context' => $streamContext,
                'exceptions' => true,
                'connection_timeout' => 15,
            ]);
        } catch (Throwable $exception) {
            throw IspConfigApiException::fromSoapFault('client_bootstrap', $exception, ['endpoint' => $endpoint]);
        }

        return $this->client;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return mixed
     */
    private function call(string $action, array $params)
    {
        try {
            return $this->client()->__soapCall($action, $params);
        } catch (SoapFault $fault) {
            throw IspConfigApiException::fromSoapFault($action, $fault, $params);
        }
    }

    public function login(): string
    {
        $sessionId = $this->call('login', [$this->remoteUser, $this->remotePassword]);

        if (! is_string($sessionId) || $sessionId === '') {
            throw new IspConfigApiException('ISPConfig login did not return a session id.', ['method' => 'login']);
        }

        return $sessionId;
    }

    public function logout(string $sessionId): void
    {
        $this->call('logout', [$sessionId]);
    }

    public function clientAdd(string $sessionId, int $resellerId, array $params): int
    {
        return (int) $this->call('client_add', [$sessionId, $resellerId, $params]);
    }

    public function clientGet(string $sessionId, int $clientId): ?array
    {
        $result = $this->call('client_get', [$sessionId, $clientId]);

        return is_array($result) ? $result : null;
    }

    /**
     * ISPConfig's client_get accepts either a numeric client_id (single
     * record) or a filter array (matching records) — passing an empty
     * filter returns all clients. Verify this against the actual installed
     * ISPConfig version via ispconfig:health-check before relying on it in
     * production; if it doesn't return a list, swap for a documented
     * listing call for that install.
     */
    public function clientList(string $sessionId): array
    {
        $result = $this->call('client_get', [$sessionId, []]);

        return is_array($result) ? $result : [];
    }

    public function sitesWebDomainAdd(string $sessionId, int $clientId, array $params): int
    {
        return (int) $this->call('sites_web_domain_add', [$sessionId, $clientId, $params]);
    }

    public function sitesWebDomainGet(string $sessionId, int $domainId): ?array
    {
        $result = $this->call('sites_web_domain_get', [$sessionId, $domainId]);

        return is_array($result) ? $result : null;
    }

    public function sitesWebDomainDelete(string $sessionId, int $domainId): int
    {
        return (int) $this->call('sites_web_domain_delete', [$sessionId, $domainId]);
    }

    public function mailDomainAdd(string $sessionId, int $clientId, array $params): int
    {
        return (int) $this->call('mail_domain_add', [$sessionId, $clientId, $params]);
    }

    public function mailDomainGet(string $sessionId, int $mailDomainId): ?array
    {
        $result = $this->call('mail_domain_get', [$sessionId, $mailDomainId]);

        return is_array($result) ? $result : null;
    }

    public function mailUserAdd(string $sessionId, int $clientId, array $params): int
    {
        return (int) $this->call('mail_user_add', [$sessionId, $clientId, $params]);
    }

    public function mailUserUpdate(string $sessionId, int $clientId, int $mailUserId, array $params): int
    {
        return (int) $this->call('mail_user_update', [$sessionId, $clientId, $mailUserId, $params]);
    }

    public function mailUserDelete(string $sessionId, int $mailUserId): int
    {
        return (int) $this->call('mail_user_delete', [$sessionId, $mailUserId]);
    }

    public function mailUserGet(string $sessionId, int $mailUserId): ?array
    {
        $result = $this->call('mail_user_get', [$sessionId, $mailUserId]);

        return is_array($result) ? $result : null;
    }

    public function databasesDatabaseAdd(string $sessionId, int $clientId, array $params): int
    {
        return (int) $this->call('sites_database_add', [$sessionId, $clientId, $params]);
    }

    public function databasesDatabaseDelete(string $sessionId, int $databaseId): int
    {
        return (int) $this->call('sites_database_delete', [$sessionId, $databaseId]);
    }

    public function databasesDatabaseUserDelete(string $sessionId, int $databaseUserId): int
    {
        return (int) $this->call('sites_database_user_delete', [$sessionId, $databaseUserId]);
    }

    public function databasesDatabaseGet(string $sessionId, int $databaseId): ?array
    {
        $result = $this->call('sites_database_get', [$sessionId, $databaseId]);

        return is_array($result) ? $result : null;
    }

    public function databasesDatabaseUserAdd(string $sessionId, int $clientId, array $params): int
    {
        return (int) $this->call('sites_database_user_add', [$sessionId, $clientId, $params]);
    }

    public function databasesDatabaseUserUpdate(string $sessionId, int $clientId, int $userId, array $params): int
    {
        return (int) $this->call('sites_database_user_update', [$sessionId, $clientId, $userId, $params]);
    }

    public function ftpUserAdd(string $sessionId, int $clientId, array $params): int
    {
        return (int) $this->call('sites_ftp_user_add', [$sessionId, $clientId, $params]);
    }

    public function ftpUserUpdate(string $sessionId, int $clientId, int $ftpUserId, array $params): int
    {
        return (int) $this->call('sites_ftp_user_update', [$sessionId, $clientId, $ftpUserId, $params]);
    }

    public function ftpUserDelete(string $sessionId, int $ftpUserId): int
    {
        return (int) $this->call('sites_ftp_user_delete', [$sessionId, $ftpUserId]);
    }

    public function ftpUserGet(string $sessionId, int $ftpUserId): ?array
    {
        $result = $this->call('sites_ftp_user_get', [$sessionId, $ftpUserId]);

        return is_array($result) ? $result : null;
    }

    public function clientGetTrafficUsage(string $sessionId, int $clientId): array
    {
        $result = $this->call('client_get_traffic_usage', [$sessionId, $clientId]);

        return is_array($result) ? $result : [];
    }

    public function sitesWebDomainGetTrafficUsage(string $sessionId, int $domainId): array
    {
        $result = $this->call('sites_web_domain_get_traffic_usage', [$sessionId, $domainId]);

        return is_array($result) ? $result : [];
    }
}
