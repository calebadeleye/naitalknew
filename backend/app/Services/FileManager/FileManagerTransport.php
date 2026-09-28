<?php

namespace App\Services\FileManager;

/**
 * How the File Manager actually reaches a hosting service's files. The real
 * implementation is SFTP/SSH against the account's own jailkit-chrooted
 * shell user — the same account type already used for client-created
 * SSH/SFTP accounts elsewhere in this app, so it physically cannot see
 * outside that one site's document root regardless of what path we pass it.
 */
interface FileManagerTransport
{
    /**
     * @throws FileManagerTransportException if the connection or login fails
     */
    public function connect(string $host, int $port, string $username, string $password): void;

    public function disconnect(): void;

    /**
     * @return array<int, array{name: string, type: string, size: int, modified_at: int, permissions: ?int}>
     */
    public function listDirectory(string $path): array;

    public function exists(string $path): bool;

    public function isDirectory(string $path): bool;

    public function putFile(string $remotePath, string $localSourcePath): bool;

    public function makeDirectory(string $path): bool;

    public function delete(string $path, bool $recursive): bool;

    /**
     * @return array{ok: bool, message: string}
     */
    public function extractZip(string $zipPath, string $destinationDir): array;

    public function downloadToLocal(string $remotePath, string $localDestinationPath): bool;
}
