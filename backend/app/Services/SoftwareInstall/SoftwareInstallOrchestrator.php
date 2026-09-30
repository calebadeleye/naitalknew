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

    /** Same ISPConfig-cron delay as the database: the new shell account's home appears asynchronously. */
    private const SHELL_HOME_ATTEMPTS = 25;

    private const SHELL_HOME_WAIT_SECONDS = 10;

    /** Written last into a finished release, so a half-built one is never reused. */
    private const RELEASE_READY_MARKER = '.release-ready';

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
            $buildRoot = rtrim($buildConfig['build_root'], '/');
            $buildDir = $buildRoot.'/'.$installation->id;

            // The expensive part (clone, composer, npm ci, the frontend
            // build) happens once per git commit, not once per install: the
            // app reads its settings at start (see the catalog's
            // runtime_config_marker), so a finished release is just copied.
            $this->progress($installation, 'preparing_release');
            $releaseDir = $this->ensureRelease($catalog, $installation->catalog_slug, $buildRoot, $installation);

            $this->progress($installation, 'copying_release');
            $this->runOrFail($buildRoot, sprintf('rm -rf %1$s && cp -a %2$s %1$s', escapeshellarg($buildDir), escapeshellarg($releaseDir)));

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

            // Runtime settings for this install, read by `next start` — the
            // prebuilt release contains no per-install values at all.
            $this->progress($installation, 'writing_frontend_configuration');
            $this->writeFrontendEnv($installation, $catalog, $buildDir);

            $this->progress($installation, 'provisioning_subdomain');
            $website = $this->provisionSubdomain($installation, $ispConfigClientId, $serverId);

            $this->progress($installation, 'provisioning_shell_account');
            $shellAccount = $this->provisionShellAccount($installation, $ispConfigClientId, $website);

            $this->progress($installation, 'deploying_files');
            $shellAccount['home'] = $this->deployFiles($installation, $catalog, $buildDir, $shellAccount);

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

            // This install's scratch copy of the release (never the release itself).
            if (isset($buildDir)) {
                $this->ssh->exec('rm -rf '.escapeshellarg($buildDir));
            }

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

    private function progress(?SoftwareInstallation $installation, string $step): void
    {
        $installation?->forceFill(['status' => 'building', 'progress_step' => $step])->save();
    }

    /**
     * The finished, reusable build of the app for the catalog's current git
     * commit, built on first use and reused by every install after it.
     * Progress steps for the slow parts are reported only when this run
     * actually has to build, and `release_reused` tells the dashboard's
     * percentage which steps this install will skip.
     */
    private function ensureRelease(array $catalog, string $slug, string $buildRoot, ?SoftwareInstallation $installation): string
    {
        $releasesDir = $buildRoot.'/releases';
        $this->ssh->makeDirectory($releasesDir);

        $releaseDir = $releasesDir.'/'.$this->releaseName($slug, $this->remoteHeadSha($catalog));

        if ($this->ssh->pathExists($releaseDir.'/'.self::RELEASE_READY_MARKER)) {
            $this->noteReleaseReused($installation, true);

            return $releaseDir;
        }

        $this->noteReleaseReused($installation, false);

        return $this->buildRelease($catalog, $slug, $releasesDir, $installation);
    }

    /**
     * Builds (or confirms) the shared release ahead of any client install —
     * `php artisan software:prepare-release <slug>` — so the first client to
     * install after a new commit does not wait for the build.
     *
     * @return array{release: string, built: bool}
     */
    public function prepareRelease(string $slug): array
    {
        $catalog = $this->catalogEntry($slug);
        $buildConfig = config('software_install');

        $this->ssh->connect(
            (string) $buildConfig['ssh_host'],
            (int) $buildConfig['ssh_port'],
            (string) $buildConfig['ssh_user'],
            ($buildConfig['ssh_private_key_path'] ?? null) ? (string) file_get_contents($buildConfig['ssh_private_key_path']) : '',
        );

        try {
            $buildRoot = rtrim($buildConfig['build_root'], '/');
            $releasesDir = $buildRoot.'/releases';
            $this->ssh->makeDirectory($releasesDir);

            $existing = $releasesDir.'/'.$this->releaseName($slug, $this->remoteHeadSha($catalog));

            if ($this->ssh->pathExists($existing.'/'.self::RELEASE_READY_MARKER)) {
                return ['release' => $existing, 'built' => false];
            }

            return ['release' => $this->buildRelease($catalog, $slug, $releasesDir, null), 'built' => true];
        } finally {
            $this->ssh->disconnect();
        }
    }

    private function releaseName(string $slug, string $sha): string
    {
        return $slug.'-'.substr($sha, 0, 12);
    }

    private function noteReleaseReused(?SoftwareInstallation $installation, bool $reused): void
    {
        $installation?->forceFill([
            'metadata_json' => array_merge($installation->metadata_json ?? [], ['release_reused' => $reused]),
        ])->save();
    }

    private function remoteHeadSha(array $catalog): string
    {
        $result = $this->runOrFail('/', sprintf(
            'git ls-remote %s %s',
            escapeshellarg($catalog['git_url']),
            escapeshellarg($catalog['git_ref']),
        ));

        if (! preg_match('/^([0-9a-f]{40})\s/m', $result['output'], $matches)) {
            throw new RuntimeException("Could not find {$catalog['git_ref']} in {$catalog['git_url']}.\n".trim($result['output']));
        }

        return $matches[1];
    }

    private function buildRelease(array $catalog, string $slug, string $releasesDir, ?SoftwareInstallation $installation): string
    {
        $workDir = $releasesDir.'/.building-'.($installation?->id ?? 'manual-'.bin2hex(random_bytes(4)));

        try {
            $this->runOrFail($releasesDir, 'rm -rf '.escapeshellarg($workDir));

            $this->progress($installation, 'cloning_repository');
            $this->runOrFail($releasesDir, sprintf(
                'git clone --branch %s --depth 1 %s %s',
                escapeshellarg($catalog['git_ref']),
                escapeshellarg($catalog['git_url']),
                escapeshellarg(basename($workDir)),
            ));

            $this->assertRuntimeConfigurable($catalog, $workDir);

            $sha = trim($this->runOrFail($workDir, 'git rev-parse HEAD')['output']);
            $releaseDir = $releasesDir.'/'.$this->releaseName($slug, $sha);

            $this->progress($installation, 'installing_backend_dependencies');
            $this->runOrFail($workDir.'/'.$catalog['backend_path'], 'composer install --no-dev --optimize-autoloader --no-interaction --no-progress');

            $this->progress($installation, 'installing_frontend_dependencies');
            $this->runOrFail($workDir, 'npm ci');

            $this->progress($installation, 'building_frontend');
            $this->runOrFail($workDir, (string) $catalog['frontend_build_command']);

            if (! $this->ssh->putFileContents($workDir.'/'.self::RELEASE_READY_MARKER, $sha)) {
                throw new RuntimeException('Could not mark the finished release as ready.');
            }

            // Publish atomically; if a concurrent install finished the same
            // release first, keep theirs and drop this copy.
            $this->runOrFail($releasesDir, sprintf(
                'if [ -e %1$s ]; then rm -rf %2$s; else mv %2$s %1$s; fi',
                escapeshellarg($releaseDir),
                escapeshellarg($workDir),
            ));

            return $releaseDir;
        } catch (\Throwable $exception) {
            $this->ssh->exec('rm -rf '.escapeshellarg($workDir));

            throw $exception;
        }
    }

    /**
     * A release is shared by every install, so it must not have any one
     * install's settings baked in. Apps that still do (NEXT_PUBLIC_* frozen
     * at build) would silently call the wrong API from every other install,
     * so refuse them outright instead.
     */
    private function assertRuntimeConfigurable(array $catalog, string $workDir): void
    {
        $marker = $catalog['runtime_config_marker'] ?? null;

        if ($marker && $this->ssh->exec('test -f '.escapeshellarg($marker), $workDir)['exit_code'] !== 0) {
            throw new RuntimeException(
                "This version of {$catalog['name']} cannot be installed yet: it still bakes its settings into the build, "
                ."so one build cannot be shared between installs. Expected {$marker} in the repository."
            );
        }
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
            // The hosting server's database is MariaDB-compatible, which has
            // no utf8mb4_0900_ai_ci — the collation Laravel's stock mysql
            // connection defaults to (config/database.php) and which made
            // every connection fail with "[1273] Unknown collation".
            'DB_CHARSET' => 'utf8mb4',
            'DB_COLLATION' => 'utf8mb4_unicode_ci',
            'DB_DATABASE' => $database['database_name'],
            'DB_USERNAME' => $database['username'],
            'DB_PASSWORD' => $database['password'],
            // predis, not phpredis: the build/hosting PHP has no redis
            // extension ("Class \"Redis\" not found" on the first cache or
            // queue call), and the app ships predis/predis for exactly this.
            'REDIS_CLIENT' => 'predis',
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
     * Moves this install's prepared copy into the client's own private/
     * directory, then symlinks Laravel's public/ dir into the web root — the
     * same layout the live everymerchant.naitalk.com deployment already uses.
     * The build account needs write access into the new site's private/ dir
     * (see the deployment note on RealSshCommandRunner); a `mv` is a rename
     * when both sit on one filesystem and a copy-then-delete when not.
     *
     * @return string the new shell account's home directory
     */
    private function deployFiles(SoftwareInstallation $installation, array $catalog, string $buildDir, array $shellAccount): string
    {
        $installPath = $installation->catalog_slug.'-'.$installation->id;
        $installation->forceFill(['install_path' => $installPath])->save();

        $home = $this->waitForShellHome($shellAccount['username']);
        $privateAppPath = $home.'/private/'.$installPath;
        $webPath = $home.'/web';

        $this->runOrFail($buildDir, sprintf('mv %s %s', escapeshellarg($buildDir), escapeshellarg($privateAppPath)));

        $this->ssh->symlink($privateAppPath.'/'.$catalog['backend_path'].'/public', $webPath.'/_backend');

        if (! $this->ssh->putFileContents($webPath.'/.htaccess', $this->buildHtaccess())) {
            throw new RuntimeException('Could not write .htaccess for the new install.');
        }

        return $home;
    }

    /**
     * Shell accounts are created on the hosting server by ISPConfig's own
     * cron, not by the API call that requested them, so the account (and its
     * private/ and web/ directories) does not exist for up to a minute. The
     * home is also looked up as a real absolute path — a `~user` inside
     * single quotes, which every command here uses, is never expanded.
     */
    private function waitForShellHome(string $username): string
    {
        for ($attempt = 1; $attempt <= self::SHELL_HOME_ATTEMPTS; $attempt++) {
            $lookup = $this->ssh->exec('getent passwd '.escapeshellarg($username).' | cut -d: -f6');
            $home = rtrim(trim($lookup['output']), '/');

            if ($lookup['exit_code'] === 0 && str_starts_with($home, '/')
                && $this->ssh->exec('test -d '.escapeshellarg($home.'/private').' && test -d '.escapeshellarg($home.'/web'))['exit_code'] === 0) {
                return $home;
            }

            if ($attempt < self::SHELL_HOME_ATTEMPTS) {
                Sleep::for(self::SHELL_HOME_WAIT_SECONDS)->seconds();
            }
        }

        throw new RuntimeException(
            "The new hosting account {$username} was still not ready after waiting "
            .((self::SHELL_HOME_ATTEMPTS - 1) * self::SHELL_HOME_WAIT_SECONDS).' seconds for ISPConfig to create it.'
        );
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
        $installPath = $shellAccount['home'].'/private/'.$installation->install_path;
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
        $webPath = $shellAccount['home'].'/web';
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
