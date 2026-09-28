<?php

namespace App\Services\Ispconfig;

use App\Models\HostingService;
use App\Models\IspConfigServiceMapping;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ssl\LiveCertificateChecker;
use Illuminate\Validation\ValidationException;

/**
 * Lets a client self-serve the three site-level settings that used to
 * require an admin touching ISPConfig directly: whether PHP runs, whether
 * the site has a working SSL certificate, and an optional reverse proxy to
 * a Node (or other) app the client runs themselves.
 *
 * ISPConfig is always the source of truth. Every read here is a live
 * `sites_web_domain_get`; every write updates ISPConfig first, then a
 * follow-up live read confirms what actually landed before the local cache
 * columns (used by the dashboard/manage page so they don't need a live call
 * on every render) are updated. If ISPConfig rejects a write, nothing local
 * changes.
 *
 * "Free SSL" here means a Let's Encrypt certificate that ISPConfig requests
 * and renews on its own — that name is deliberately never used client-side.
 */
class WebsiteSettingsService
{
    private const PROXY_BLOCK_START = '# BEGIN NAI-TALK-PROXY (do not edit by hand — managed from your NAI TALK dashboard)';

    private const PROXY_BLOCK_END = '# END NAI-TALK-PROXY';

    public function __construct(
        private readonly IspConfigClient $ispConfig,
        private readonly LiveCertificateChecker $certificateChecker = new LiveCertificateChecker,
    ) {}

    /**
     * @return array{php: array{enabled: bool}, ssl: array{enabled: bool, mode: ?string, active: bool, domain: ?string}, proxy: array{enabled: bool, port: ?int}, synced_at: string}
     */
    public function read(HostingService $service): array
    {
        $sessionId = $this->ispConfig->login();

        try {
            $site = $this->getSite($service, $sessionId);

            return $this->cache($service, $site);
        } finally {
            $this->ispConfig->logout($sessionId);
        }
    }

    public function setPhpEnabled(HostingService $service, bool $enabled): array
    {
        return $this->update($service, $enabled ? [
            'php' => 'php-fpm',
            'php_fpm_use_socket' => 'y',
            'pm' => 'ondemand',
        ] : [
            'php' => 'no',
            'php_fpm_use_socket' => 'n',
        ]);
    }

    /**
     * Requests a certificate ISPConfig manages and renews automatically.
     * Issuance is not instant — `ssl.active` stays false until ISPConfig has
     * actually obtained the certificate (checked on the next read of this
     * page, or the periodic sync).
     */
    public function enableFreeSsl(HostingService $service): array
    {
        return $this->update($service, [
            'ssl' => 'y',
            'ssl_letsencrypt' => 'y',
            'ssl_letsencrypt_exclude' => 'n',
            'ssl_action' => 'save',
        ]);
    }

    /**
     * @throws ValidationException if the certificate and key don't belong together
     */
    public function installCustomSsl(HostingService $service, string $certificatePem, string $privateKeyPem, ?string $bundlePem = null): array
    {
        $this->assertCertificateMatchesKey($certificatePem, $privateKeyPem);

        return $this->update($service, [
            'ssl' => 'y',
            'ssl_letsencrypt' => 'n',
            'ssl_cert' => $certificatePem,
            'ssl_key' => $privateKeyPem,
            'ssl_bundle' => $bundlePem ?? '',
            'ssl_action' => 'save',
        ]);
    }

    public function disableSsl(HostingService $service): array
    {
        return $this->update($service, ['ssl' => 'n']);
    }

    /**
     * @throws ValidationException if the port is already used by another of the client's sites
     */
    public function setProxy(HostingService $service, ?int $port): array
    {
        if ($port !== null) {
            $taken = HostingService::query()
                ->where('id', '!=', $service->id)
                ->where('website_reverse_proxy_enabled', true)
                ->where('website_reverse_proxy_port', $port)
                ->exists();

            if ($taken) {
                throw ValidationException::withMessages(['port' => ["Port {$port} is already in use on this server. Choose a different port."]]);
            }
        }

        $sessionId = $this->ispConfig->login();

        try {
            $site = $this->getSite($service, $sessionId);
            $currentDirectives = (string) ($site['apache_directives'] ?? '');
            $withoutManagedBlock = $this->stripManagedBlock($currentDirectives);
            $newDirectives = $port !== null
                ? rtrim($withoutManagedBlock)."\n\n".$this->buildProxyBlock($port)
                : $withoutManagedBlock;

            $mapping = $this->mapping($service);
            $this->ispConfig->sitesWebDomainUpdate($sessionId, (int) $mapping->clientMapping->ispconfig_client_id, (int) $mapping->ispconfig_website_id, [
                'apache_directives' => trim($newDirectives),
            ]);

            $site = $this->getSite($service, $sessionId);

            return $this->cache($service, $site);
        } finally {
            $this->ispConfig->logout($sessionId);
        }
    }

    /**
     * @param  array<string, mixed>  $fields
     */
    private function update(HostingService $service, array $fields): array
    {
        $sessionId = $this->ispConfig->login();

        try {
            $mapping = $this->mapping($service);
            $this->ispConfig->sitesWebDomainUpdate($sessionId, (int) $mapping->clientMapping->ispconfig_client_id, (int) $mapping->ispconfig_website_id, $fields);

            $site = $this->getSite($service, $sessionId);

            return $this->cache($service, $site);
        } finally {
            $this->ispConfig->logout($sessionId);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getSite(HostingService $service, string $sessionId): array
    {
        $mapping = $this->mapping($service);
        $site = $this->ispConfig->sitesWebDomainGet($sessionId, (int) $mapping->ispconfig_website_id);

        if ($site === null) {
            throw new IspConfigApiException('This website could not be found in ISPConfig.', ['hosting_service_id' => $service->id]);
        }

        return $site;
    }

    private function mapping(HostingService $service): IspConfigServiceMapping
    {
        $mapping = $service->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first();

        if (! $mapping?->ispconfig_website_id || ! $mapping->clientMapping?->ispconfig_client_id) {
            throw new IspConfigApiException('This service is not provisioned in ISPConfig yet.', ['hosting_service_id' => $service->id]);
        }

        return $mapping;
    }

    /**
     * @param  array<string, mixed>  $site
     * @return array{php: array{enabled: bool}, ssl: array{enabled: bool, mode: ?string, active: bool, domain: ?string}, proxy: array{enabled: bool, port: ?int}, synced_at: string}
     */
    private function cache(HostingService $service, array $site): array
    {
        $domain = $site['domain'] ?? $service->primary_domain;
        $phpEnabled = self::phpEnabledFromSite($site);
        // The one thing here that is NOT read from ISPConfig's own record: a
        // live TLS handshake against the domain, checking what certificate is
        // really being served. See LiveCertificateChecker for why.
        $certificate = $domain ? $this->certificateChecker->check($domain) : ['active' => false, 'expires_at' => null];
        $sslActive = ($site['ssl'] ?? 'n') === 'y' && $certificate['active'];
        $sslExpiresAt = $certificate['expires_at'];
        $sslMode = self::sslModeFromSite($site, $service->website_ssl_mode);
        $proxy = self::proxyFromSite($site['apache_directives'] ?? null);
        $syncedAt = now();

        $service->forceFill([
            'website_php_enabled' => $phpEnabled,
            'website_ssl_active' => $sslActive,
            'website_ssl_expires_at' => $sslExpiresAt,
            'website_ssl_mode' => $sslMode,
            'website_reverse_proxy_enabled' => $proxy['enabled'],
            'website_reverse_proxy_port' => $proxy['port'],
            'website_settings_synced_at' => $syncedAt,
        ])->save();

        return [
            'php' => ['enabled' => $phpEnabled],
            'ssl' => [
                'enabled' => ($site['ssl'] ?? 'n') === 'y',
                'mode' => $sslMode,
                'active' => $sslActive,
                'domain' => $site['domain'] ?? $service->primary_domain,
            ],
            'proxy' => $proxy,
            'synced_at' => $syncedAt->toIso8601String(),
        ];
    }

    public static function phpEnabledFromSite(array $site): bool
    {
        return ! in_array($site['php'] ?? 'no', ['no', '', null], true);
    }

    public static function sslModeFromSite(array $site, ?string $cachedMode): ?string
    {
        if (($site['ssl'] ?? 'n') !== 'y') {
            return null;
        }

        if (($site['ssl_letsencrypt'] ?? 'n') === 'y') {
            return 'free';
        }

        if (trim((string) ($site['ssl_cert'] ?? '')) !== '') {
            return 'custom';
        }

        // SSL is on but no certificate is on file yet: keep whatever mode was
        // last requested (e.g. a free-SSL request still pending issuance)
        // rather than reporting no mode at all.
        return $cachedMode;
    }

    /**
     * @return array{enabled: bool, port: ?int}
     */
    public static function proxyFromSite(?string $apacheDirectives): array
    {
        if ($apacheDirectives && preg_match('/ProxyPass \/ http:\/\/127\.0\.0\.1:(\d+)\//', $apacheDirectives, $matches)) {
            return ['enabled' => true, 'port' => (int) $matches[1]];
        }

        return ['enabled' => false, 'port' => null];
    }

    private function stripManagedBlock(string $directives): string
    {
        $pattern = '/'.preg_quote(self::PROXY_BLOCK_START, '/').'.*?'.preg_quote(self::PROXY_BLOCK_END, '/').'/s';

        return trim(preg_replace($pattern, '', $directives) ?? '');
    }

    private function buildProxyBlock(int $port): string
    {
        return implode("\n", [
            self::PROXY_BLOCK_START,
            'ProxyPreserveHost On',
            'ProxyPass /.well-known/acme-challenge/ !',
            "ProxyPass / http://127.0.0.1:{$port}/",
            "ProxyPassReverse / http://127.0.0.1:{$port}/",
            self::PROXY_BLOCK_END,
        ]);
    }

    private function assertCertificateMatchesKey(string $certificatePem, string $privateKeyPem): void
    {
        $cert = @openssl_x509_read($certificatePem);

        if ($cert === false) {
            throw ValidationException::withMessages(['certificate' => ['That does not look like a valid certificate (PEM format expected).']]);
        }

        $key = @openssl_pkey_get_private($privateKeyPem);

        if ($key === false) {
            throw ValidationException::withMessages(['private_key' => ['That does not look like a valid private key (PEM format expected, and it must not be password-protected).']]);
        }

        if (! openssl_x509_check_private_key($cert, $key)) {
            throw ValidationException::withMessages(['private_key' => ['This private key does not match the certificate you provided.']]);
        }

        $expiresAt = openssl_x509_parse($cert)['validTo_time_t'] ?? null;

        if ($expiresAt !== null && $expiresAt < now()->timestamp) {
            throw ValidationException::withMessages(['certificate' => ['This certificate has already expired.']]);
        }
    }
}
