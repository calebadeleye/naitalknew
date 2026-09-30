<?php

namespace App\Services\SoftwareInstall;

/**
 * Runs shell commands on the hosting server on behalf of a software install
 * (git clone, composer/npm, artisan migrate/seed, pm2) — capabilities
 * ISPConfig's remote API has no equivalent for. Deliberately a separate,
 * broader interface from FileManagerTransport, which is intentionally
 * confined to a single jailkit-chrooted account's own files; this one needs
 * to build in one place and place files in another.
 *
 * Which account this actually connects as (the dedicated, resource-capped
 * build account) is a deployment-time credential, configured the same way
 * `ISPCONFIG_REMOTE_USER`/`ISPCONFIG_REMOTE_PASSWORD` are — see
 * config/software_install.php.
 */
interface SshCommandRunner
{
    /**
     * @throws SshCommandException if the connection or login fails
     */
    public function connect(string $host, int $port, string $username, string $privateKey): void;

    public function disconnect(): void;

    /**
     * @return array{exit_code: int, output: string}
     */
    public function exec(string $command, ?string $cwd = null): array;

    public function putFileContents(string $remotePath, string $contents): bool;

    public function makeDirectory(string $path): bool;

    public function symlink(string $target, string $link): bool;

    public function pathExists(string $path): bool;
}
