<?php

namespace App\Services\FileManager;

use ZipArchive;

/**
 * Test double: a real local temp directory stands in for the remote
 * account's chrooted filesystem, so FileManagerService's own logic (path
 * handling, hidden-file filtering, response shaping) is exercised against a
 * real filesystem without a real SSH server. extractZip really extracts
 * with PHP's ZipArchive, the same way the real transport really runs unzip.
 */
class FakeFileManagerTransport implements FileManagerTransport
{
    private string $root;

    public array $connectCalls = [];

    public function __construct(?string $root = null)
    {
        $this->root = $root ?? sys_get_temp_dir().'/fm-fake-'.uniqid();
        @mkdir($this->root.'/web', 0755, true);
    }

    public function rootDir(): string
    {
        return $this->root;
    }

    public function connect(string $host, int $port, string $username, string $password): void
    {
        $this->connectCalls[] = compact('host', 'port', 'username', 'password');
    }

    public function disconnect(): void {}

    private function full(string $path): string
    {
        return $this->root.'/'.ltrim($path, '/');
    }

    public function listDirectory(string $path): array
    {
        $full = $this->full($path);

        if (! is_dir($full)) {
            return [];
        }

        $rows = [];

        foreach (scandir($full) ?: [] as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $entryPath = $full.'/'.$name;

            $rows[] = [
                'name' => $name,
                'type' => is_dir($entryPath) ? 'dir' : 'file',
                'size' => is_file($entryPath) ? (int) filesize($entryPath) : 0,
                'modified_at' => (int) filemtime($entryPath),
                'permissions' => fileperms($entryPath),
            ];
        }

        return $rows;
    }

    public function exists(string $path): bool
    {
        return file_exists($this->full($path));
    }

    public function isDirectory(string $path): bool
    {
        return is_dir($this->full($path));
    }

    public function putFile(string $remotePath, string $localSourcePath): bool
    {
        @mkdir(dirname($this->full($remotePath)), 0755, true);

        return copy($localSourcePath, $this->full($remotePath));
    }

    public function makeDirectory(string $path): bool
    {
        return @mkdir($this->full($path), 0755, true);
    }

    public function delete(string $path, bool $recursive): bool
    {
        $full = $this->full($path);

        if (is_dir($full)) {
            if ($recursive) {
                $this->removeDirectoryRecursively($full);

                return true;
            }

            return @rmdir($full);
        }

        return @unlink($full);
    }

    public function extractZip(string $zipPath, string $destinationDir): array
    {
        $zip = new ZipArchive;
        $result = $zip->open($this->full($zipPath));

        if ($result !== true) {
            return ['ok' => false, 'message' => "Could not open zip (code {$result})."];
        }

        $destination = $this->full($destinationDir);
        @mkdir($destination, 0755, true);
        $extracted = $zip->extractTo($destination);
        $count = $zip->numFiles;
        $zip->close();

        return $extracted
            ? ['ok' => true, 'message' => "Extracted {$count} entries."]
            : ['ok' => false, 'message' => 'Extraction failed.'];
    }

    public function downloadToLocal(string $remotePath, string $localDestinationPath): bool
    {
        return copy($this->full($remotePath), $localDestinationPath);
    }

    private function removeDirectoryRecursively(string $dir): void
    {
        foreach (scandir($dir) ?: [] as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $path = $dir.'/'.$name;
            is_dir($path) ? $this->removeDirectoryRecursively($path) : @unlink($path);
        }

        @rmdir($dir);
    }
}
