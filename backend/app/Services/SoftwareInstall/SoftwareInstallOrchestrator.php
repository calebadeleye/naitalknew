<?php

namespace App\Services\SoftwareInstall;

use App\Models\HostingService;
use App\Models\SoftwareInstallation;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Drives a one-click "Software" install end to end: clone → build (on the
 * dedicated, resource-capped build account, never on the shared server's own
 * client-facing paths) → provision a new subdomain + database + Redis slot
 * in ISPConfig → copy the built app into the client's own hosting space →
 * start it under PM2.
 *
 * Every step updates `progress_step` on the installation record so the
 * client's dashboard (polling GET .../software/{id}) shows real progress.
 * Any exception part-way through triggers `rollback()` for whatever
 * succeeded so far, rather than leaving half-provisioned resources behind.
 */
class SoftwareInstallOrchestrator
{
    /** 25 tries, 10s apart: four minutes, several ISPConfig cron cycles. */
    private const DATABASE_READY_ATTEMPTS = 25;

    private const DATABASE_READY_WAIT_SECONDS = 10;

    public function __construct(
        private readonly IspConfigClient $ispConfig,
        private readonly SshCommandRunner $ssh,
    ) {}

    public function install(SoftwareInstallation $installation): void
    {
        $catalog = $this->catalogEntry($installation->catalog_slug);
        $service = $installation->hostingService;
        $mapping = $service->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first();

        if (! $mapping?->clientMapping?->ispconfig_client_id) {
            throw new RuntimeException('This hosting service is not provisioned in ISPConfig yet.');
        }

        $ispConfigClientId = (int) $mapping->clientMapping->ispconfig_client_id;
        $serverId = (int) ($service->ispconfig_server_id ?: config('ispconfig.server_id'));
        $buildConfig = config('software_install');

        $this->progress($installation, 'connecting_build_account');
        $keyPath = $buildConfig['ssh_private_key_path'] ?? null;
        $this->ssh->connect(
            (string) $buildConfig['ssh_host'],
            (int) $buildConfig['ssh_port'],
            (string) $buildConfig['ssh_user'],
            $keyPath ? (string) file_get_contents($keyPath) : '',
        );

        try {
            $buildDir = rtrim($buildConfig['build_root'], '/').'/'.$installation->id;

            $this->progress($installation, 'cloning_repository');
            $this->cloneRepository($catalog, $buildDir);

            $this->progress($installation, 'installing_backend_dependencies');
            $this->runOrFail($buildDir.'/'.$catalog['backend_path'], 'composer install --no-dev --optimize-autoloader');

            $this->progress($installation, 'allocating_database');
            $database = $this->allocateDatabase($installation, $ispConfigClientId, $serverId);

            $this->progress($installation, 'allocating_redis_slot');
            $redis = $this->allocateRedisSlot($installation);

            $this->progress($installation, 'writing_backend_configuration');
            $adminPassword = $this->writeBackendEnv($installation, $catalog, $buildDir, $database, $redis);

            $this->progress($installation, 'running_migrations');
            $this->runMigrationsOnceDatabaseIsLive($buildDir.'/'.$catalog['backend_path']);

            $this->progress($installation, 'seeding_initial_data');
            $seedOutput = $this->runOrFail($buildDir.'/'.$catalog['backend_path'], 'php artisan db:seed --force');
            $adminPassword = $this->extractGeneratedPassword($seedOutput) ?? $adminPassword;

            $this->progress($installation, 'installing_frontend_dependencies');
            $this->runOrFail($buildDir, 'npm ci');

            $this->progress($installation, 'writing_frontend_configuration');
            $this->writeFrontendEnv($installation, $catalog, $buildDir);

            $this->progress($installation, 'building_frontend');
            $this->runOrFail($buildDir, (string) $catalog['frontend_build_command']);

            $this->progress($installation, 'provisioning_subdomain');
            $website = $this->provisionSubdomain($installation, $ispConfigClientId, $serverId);

            $this->progress($installation, 'provisioning_shell_account');
            $shellAccount = $this->provisionShellAccount($installation, $ispConfigClientId, $website);

            $this->progress($installation, 'deploying_files');
            $this->deployFiles($installation, $catalog, $buildDir, $shellAccount);

            $this->progress($installation, 'requesting_ssl');
            $this->requestFreeSsl($ispConfigClientId, (int) $website['domain_id']);

            $this->progress($installation, 'starting_application');
            $nodePort = $this->allocateNodePort();
            $this->startProcesses($installation, $catalog, $shellAccount, $nodePort);

            $installation->forceFill([
                'status' => 'active',
                'progress_step' => null,
                'node_port' => $nodePort,
                'admin_password_shown_once' => $adminPassword,
                'installed_at' => now(),
                'metadata_json' => array_merge($installation->metadata_json ?? [], [
                    'ispconfig_website_id' => $website['domain_id'],
                ]),
            ])->save();
        } catch (\Throwable $exception) {
            $this->rollback($installation, $ispConfigClientId);

            throw $exception;
        } finally {
            $this->ssh->disconnect();
        }
    }

    /**
     * Best-effort cleanup of whatever the failed attempt already created.
     * Never throws — a rollback step failing must not hide the original
     * error or leave the installation stuck in a non-terminal state.
     */
    public function rollback(SoftwareInstallation $installation, int $ispConfigClientId): void
    {
        $metadata = $installation->metadata_json ?? [];

        try {
            if (! empty($metadata['ispconfig_website_id'])) {
                $sessionId = $this->ispConfig->login();

                try {
                    $this->ispConfig->sitesWebDomainDelete($sessionId, (int) $metadata['ispconfig_website_id']);
                } finally {
                    $this->ispConfig->logout($sessionId);
                }
            }
        } catch (\Throwable) {
            // Best effort — surfaced via the original exception, not this one.
        }

        try {
            if (! empty($metadata['ispconfig_database_id'])) {
                $sessionId = $this->ispConfig->login();

                try {
                    $this->ispConfig->databasesDatabaseDelete($sessionId, (int) $metadata['ispconfig_database_id']);

                    if (! empty($metadata['ispconfig_database_user_id'])) {
                        $this->ispConfig->databasesDatabaseUserDelete($sessionId, (int) $metadata['ispconfig_database_user_id']);
                    }
                } finally {
                    $this->ispConfig->logout($sessionId);
                }
            }
        } catch (\Throwable) {
            // Best effort.
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function catalogEntry(string $slug): array
    {
        $entry = config("software_catalog.{$slug}");

        if (! $entry) {
            throw new RuntimeException("Unknown software catalog entry: {$slug}");
        }

        return $entry;
    }

    private function progress(SoftwareInstallation $installation, string $step): void
    {
        $installation->forceFill(['status' => 'building', 'progress_step' => $step])->save();
    }

    private function cloneRepository(array $catalog, string $buildDir): void
    {
        $this->ssh->makeDirectory(dirname($buildDir));
        $this->runOrFail(dirname($buildDir), sprintf(
            'git clone --branch %s --depth 1 %s %s',
            escapeshellarg($catalog['git_ref']),
            escapeshellarg($catalog['git_url']),
            escapeshellarg(basename($buildDir)),
        ));
    }

    /**
     * @return array{exit_code: int, output: string}
     */
    private function runOrFail(string $cwd, string $command): array
    {
        $result = $this->ssh->exec($command, $cwd);

        if ($result['exit_code'] !== 0) {
            $this->throwCommandFailure($cwd, $command, $result);
        }

        return $result;
    }

    /**
     * @param  array{exit_code: int, output: string}  $result
     */
    private function throwCommandFailure(string $cwd, string $command, array $result): never
    {
        // Only the tail: a failing composer/npm run can emit hundreds of
        // progress lines, and the actual error is always at the end.
        $output = trim($result['output']);
        $output = strlen($output) > 3000 ? '…'.substr($output, -3000) : $output;

        throw new RuntimeException("Command failed ({$result['exit_code']}) in {$cwd}: {$command}\n".$output);
    }

    /**
     * ISPConfig's API only queues the new database and user — its server
     * cron applies them to MySQL, typically within a minute. Until then
     * MySQL refuses the login ("[1045] Access denied" for a user that doesn't
     * exist yet, "[1049]" for the database), so migrate is retried on
     * exactly those connection errors. A refused connection has run no
     * migration, so retrying is safe; anything else fails immediately.
     */
    private function runMigrationsOnceDatabaseIsLive(string $backendDir): void
    {
        $attempts = self::DATABASE_READY_ATTEMPTS;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            $result = $this->ssh->exec('php artisan migrate --force', $backendDir);

            if ($result['exit_code'] === 0) {
                return;
            }

            $notLiveYet = preg_match('/SQLSTATE\[HY000\] \[(1045|1049)\]/', $result['output']) === 1;

            if (! $notLiveYet) {
                break;
            }

            if ($attempt === $attempts) {
                $result['output'] .= "\n[The new database login was still refused after waiting "
                    .(($attempts - 1) * self::DATABASE_READY_WAIT_SECONDS).' seconds for ISPConfig to create it.]';
                break;
            }

            Sleep::for(self::DATABASE_READY_WAIT_SECONDS)->seconds();
        }

        $this->throwCommandFailure($backendDir, 'php artisan migrate --force', $result);
    }

    /**
     * @return array{database_name: string, username: string, password: string, ispconfig_database_id: int, ispconfig_database_user_id: int}
     */
    private function allocateDatabase(SoftwareInstallation $installation, int $ispConfigClientId, int $serverId): array
    {
        $databaseName = 'sw'.$installation->id.'_'.Str::lower(Str::random(6));
        $username = $databaseName;
        $password = Str::random(24);

        $sessionId = $this->ispConfig->login();

        try {
            $userId = $this->ispConfig->databasesDatabaseUserAdd($sessionId, $ispConfigClientId, [
                'database_user' => $username,
                'database_password' => $password,
            ]);

            $databaseId = $this->ispConfig->databasesDatabaseAdd($sessionId, $ispConfigClientId, [
                'server_id' => $serverId,
                'type' => 'mysql',
                'database_name' => $databaseName,
                'database_user_id' => $userId,
                'database_charset' => 'utf8mb4',
                'remote_access' => 'n',
                'active' => 'y',
            ]);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        $installation->forceFill([
            'metadata_json' => array_merge($installation->metadata_json ?? [], [
                'ispconfig_database_id' => $databaseId,
                'ispconfig_database_user_id' => $userId,
            ]),
        ])->save();

        return [
            'database_name' => $databaseName,
            'username' => $username,
            'password' => $password,
            'ispconfig_database_id' => $databaseId,
            'ispconfig_database_user_id' => $userId,
        ];
    }

    /**
     * @return array{db: int, cache_db: int, queue_db: int}
     */
    private function allocateRedisSlot(SoftwareInstallation $installation): array
    {
        $maxIndex = (int) config('software_install.redis_max_db_index', 15);

        $used = SoftwareInstallation::query()
            ->whereNotNull('redis_db_index')
            ->where('id', '!=', $installation->id)
            ->get(['redis_db_index', 'redis_cache_db_index', 'redis_queue_db_index'])
            ->flatMap(fn ($row) => [$row->redis_db_index, $row->redis_cache_db_index, $row->redis_queue_db_index])
            ->filter()
            ->all();

        $free = [];

        for ($index = 1; $index <= $maxIndex; $index++) {
            if (! in_array($index, $used, true)) {
                $free[] = $index;
            }

            if (count($free) === 3) {
                break;
            }
        }

        if (count($free) < 3) {
            throw new RuntimeException('No free Redis database slots left on the shared instance — it supports at most 15 usable indices, three per install.');
        }

        [$db, $cacheDb, $queueDb] = $free;

        $installation->forceFill([
            'redis_db_index' => $db,
            'redis_cache_db_index' => $cacheDb,
            'redis_queue_db_index' => $queueDb,
        ])->save();

        return ['db' => $db, 'cache_db' => $cacheDb, 'queue_db' => $queueDb];
    }

    private function allocateNodePort(): int
    {
        $start = (int) config('software_install.node_port_range_start', 4100);
        $end = (int) config('software_install.node_port_range_end', 4999);

        $used = SoftwareInstallation::query()->whereNotNull('node_port')->pluck('node_port')->all();

        for ($port = $start; $port <= $end; $port++) {
            if (! in_array($port, $used, true)) {
                return $port;
            }
        }

        throw new RuntimeException('No free ports left in the configured Node port range.');
    }

    /**
     * @return string the admin password to show the client (may be
     *                 overwritten later once the seeder's own output is read)
     */
    private function writeBackendEnv(SoftwareInstallation $installation, array $catalog, string $buildDir, array $database, array $redis): string
    {
        $backendDir = $buildDir.'/'.$catalog['backend_path'];
        $appKey = 'base64:'.base64_encode(random_bytes(32));
        $adminPassword = Str::random(20).'aA1!';
        $url = 'https://'.$installation->subdomain;

        $env = [
            'APP_NAME' => '"'.$catalog['name'].'"',
            'APP_ENV' => 'production',
            'APP_KEY' => $appKey,
            'APP_DEBUG' => 'false',
            'APP_URL' => $url,
            'ADMIN_APP_URL' => $url,
            'DB_CONNECTION' => 'mysql',
            'DB_HOST' => '127.0.0.1',
            'DB_PORT' => '3306',
            'DB_DATABASE' => $database['database_name'],
            'DB_USERNAME' => $database['username'],
            'DB_PASSWORD' => $database['password'],
            'REDIS_CLIENT' => 'phpredis',
            'REDIS_HOST' => config('software_install.redis_host'),
            'REDIS_PORT' => (string) config('software_install.redis_port'),
            'REDIS_PASSWORD' => config('software_install.redis_password') ?: 'null',
            'REDIS_DB' => (string) $redis['db'],
            'REDIS_CACHE_DB' => (string) $redis['cache_db'],
            'REDIS_QUEUE_DB' => (string) $redis['queue_db'],
            'CACHE_STORE' => 'redis',
            'CACHE_PREFIX' => 'naipay_sw'.$installation->id,
            'QUEUE_CONNECTION' => 'redis',
            'SESSION_DRIVER' => 'redis',
            'SESSION_SECURE_COOKIE' => 'true',
            'MAIL_MAILER' => 'log',
            'NAIPAY_INITIAL_ADMIN_EMAIL' => $installation->admin_email,
            'NAIPAY_INITIAL_ADMIN_PASSWORD' => $adminPassword,
        ];

        $contents = collect($env)->map(fn ($value, $key) => "{$key}={$value}")->implode("\n");

        if (! $this->ssh->putFileContents($backendDir.'/.env', $contents)) {
            throw new RuntimeException('Could not write the backend .env file.');
        }

        return $adminPassword;
    }

    private function writeFrontendEnv(SoftwareInstallation $installation, array $catalog, string $buildDir): void
    {
        $frontendDir = $buildDir.'/'.$catalog['frontend_path'];

        $contents = collect($catalog['frontend_env'] ?? [])
            ->map(fn ($value) => str_replace('{subdomain}', $installation->subdomain, $value))
            ->map(fn ($value, $key) => "{$key}={$value}")
            ->implode("\n");

        if (! $this->ssh->putFileContents($frontendDir.'/.env.production.local', $contents)) {
            throw new RuntimeException('Could not write the frontend environment file.');
        }
    }

    /**
     * Looks for the one-time password SuperAdministratorSeeder prints to its
     * own console output ("  Password: ...") so the client sees the value
     * that actually landed in the database, not just the one we requested —
     * belt and braces in case the seeder ever changes its generation rule.
     */
    private function extractGeneratedPassword(array $seedResult): ?string
    {
        if (preg_match('/Password:\s*(\S+)/', $seedResult['output'], $matches)) {
            return $matches[1];
        }

        return null;
    }

    /**
     * @return array{domain_id: int, system_user: string, system_group: string, document_root: string, server_id: int}
     */
    private function provisionSubdomain(SoftwareInstallation $installation, int $ispConfigClientId, int $serverId): array
    {
        $sessionId = $this->ispConfig->login();

        try {
            $domainId = $this->ispConfig->sitesWebDomainAdd($sessionId, $ispConfigClientId, [
                'server_id' => $serverId,
                'domain' => $installation->subdomain,
                'type' => 'vhost',
                'ip_address' => '*',
                'hd_quota' => 2048,
                'traffic_quota' => 10240,
                'php_version' => '8.3',
                'ssl' => 'n',
                'ssh_chroot' => 'jailkit',
                'active' => 'y',
                'allow_override' => 'All',
                'http_port' => '80',
                'https_port' => '443',
            ]);

            $website = $this->ispConfig->sitesWebDomainGet($sessionId, $domainId);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        if (! $website) {
            throw new RuntimeException('The new subdomain could not be read back from ISPConfig right after creating it.');
        }

        $installation->forceFill([
            'metadata_json' => array_merge($installation->metadata_json ?? [], ['ispconfig_website_id' => $domainId]),
        ])->save();

        return [
            'domain_id' => $domainId,
            'system_user' => $website['system_user'],
            'system_group' => $website['system_group'],
            'document_root' => $website['document_root'],
            'server_id' => $serverId,
        ];
    }

    /**
     * @return array{username: string, password: string}
     */
    private function provisionShellAccount(SoftwareInstallation $installation, int $ispConfigClientId, array $website): array
    {
        $username = 'sw-'.$installation->id.'-'.Str::lower(Str::random(6));
        $password = Str::random(32);

        $sessionId = $this->ispConfig->login();

        try {
            $this->ispConfig->shellUserAdd($sessionId, $ispConfigClientId, [
                'username' => $username,
                'password' => $password,
                'parent_domain_id' => $website['domain_id'],
                'server_id' => $website['server_id'],
                'puser' => $website['system_user'],
                'pgroup' => $website['system_group'],
                'dir' => $website['document_root'],
                'quota_size' => -1,
                'active' => 'y',
                'shell' => config('ispconfig.ssh_shell', '/bin/bash'),
                'chroot' => config('ispconfig.ssh_chroot', 'jailkit'),
            ]);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        return ['username' => $username, 'password' => $password];
    }

    /**
     * Copies the whole built tree from the build account into the client's
     * own private/ directory, then symlinks Laravel's public/ dir into the
     * web root — the same layout the live everymerchant.naitalk.com
     * deployment already uses. Both accounts live on the same filesystem, so
     * this is a local copy on the build account's side (it needs write
     * access into the new site's private/ dir — see the deployment note on
     * the build account's required privilege).
     */
    private function deployFiles(SoftwareInstallation $installation, array $catalog, string $buildDir, array $shellAccount): void
    {
        $installPath = 'naipay-'.$installation->id;
        $installation->forceFill(['install_path' => $installPath])->save();

        // ~/private and ~/web are the two sibling directories every ISPConfig
        // jailkit shell account gets (see FileManagerAccountProvisioner) —
        // the private one is never web-reachable. Both accounts live on the
        // same filesystem, so this is a local copy, not a network transfer;
        // it requires the build account to have write access into the new
        // site's private/ dir (see the deployment privilege note on
        // RealSshCommandRunner).
        $destination = '~'.$shellAccount['username'].'/private/'.$installPath;
        $this->runOrFail($buildDir, sprintf('cp -a %s %s', escapeshellarg($buildDir), escapeshellarg($destination)));

        $privateAppPath = '~'.$shellAccount['username'].'/private/'.$installPath;
        $webPath = '~'.$shellAccount['username'].'/web';

        $this->ssh->symlink($privateAppPath.'/'.$catalog['backend_path'].'/public', $webPath.'/_backend');

        $htaccess = $this->buildHtaccess();

        if (! $this->ssh->putFileContents($webPath.'/.htaccess', $htaccess)) {
            throw new RuntimeException('Could not write .htaccess for the new install.');
        }
    }

    /**
     * Adapted directly from everymerchant.naitalk.com's own working
     * .htaccess (read off the live server) — the node port is filled in by
     * the caller once it's been allocated. `{{PORT}}` is a plain string
     * placeholder, replaced before writing.
     */
    private function buildHtaccess(): string
    {
        return <<<'HTACCESS'
DirectoryIndex disabled

RewriteEngine On

RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

RewriteRule ^api/(.*)$ _backend/$1 [L]
RewriteRule ^up$ _backend/index.php [L]

RewriteRule ^(.*)$ http://127.0.0.1:{{PORT}}/$1 [P,L]
HTACCESS;
    }

    private function requestFreeSsl(int $ispConfigClientId, int $domainId): void
    {
        $sessionId = $this->ispConfig->login();

        try {
            $this->ispConfig->sitesWebDomainUpdate($sessionId, $ispConfigClientId, $domainId, [
                'ssl' => 'y',
                'ssl_letsencrypt' => 'y',
                'ssl_letsencrypt_exclude' => 'n',
                'ssl_action' => 'save',
            ]);
        } catch (IspConfigApiException) {
            // Not fatal to the install — the app is reachable over plain
            // HTTP immediately and the periodic SSL sync job (same one that
            // covers every other client site) will pick this up.
        } finally {
            $this->ispConfig->logout($sessionId);
        }
    }

    private function startProcesses(SoftwareInstallation $installation, array $catalog, array $shellAccount, int $nodePort): void
    {
        $installPath = '~'.$shellAccount['username'].'/private/'.$installation->install_path;
        $frontendDir = $installPath.'/'.$catalog['frontend_path'];
        $backendDir = $installPath.'/'.$catalog['backend_path'];

        $startCommand = str_replace('{port}', (string) $nodePort, (string) $catalog['frontend_start_command']);
        $frontendProcessName = 'sw-'.$installation->id.'-web';
        $queueProcessName = 'sw-'.$installation->id.'-queue';

        $this->runOrFail($frontendDir, sprintf('pm2 start "%s" --name %s', $startCommand, escapeshellarg($frontendProcessName)));
        $this->runOrFail($backendDir, sprintf('pm2 start "%s" --name %s', $catalog['queue_worker_command'], escapeshellarg($queueProcessName)));
        $this->ssh->exec('pm2 save');

        // The htaccess was written with a placeholder port before this port
        // was known — fill it in now that PM2 has actually started on it.
        $webPath = '~'.$shellAccount['username'].'/web';
        $htaccess = str_replace('{{PORT}}', (string) $nodePort, $this->buildHtaccess());
        $this->ssh->putFileContents($webPath.'/.htaccess', $htaccess);

        $installation->forceFill([
            'metadata_json' => array_merge($installation->metadata_json ?? [], [
                'pm2_frontend_process' => $frontendProcessName,
                'pm2_queue_process' => $queueProcessName,
                'shell_username' => $shellAccount['username'],
            ]),
        ])->save();
    }
}
