<?php

namespace App\Services\FileManager;

use phpseclib3\Net\SFTP;
use Throwable;

class Phpseclib3FileManagerTransport implements FileManagerTransport
{
    private ?SFTP $sftp = null;

    public function connect(string $host, int $port, string $username, string $password): void
    {
        try {
            $sftp = new SFTP($host, $port, 10);
        } catch (Throwable $exception) {
            throw new FileManagerTransportException('Could not reach the server: '.$exception->getMessage(), 0, $exception);
        }

        if (! $sftp->login($username, $password)) {
            throw new FileManagerTransportException('Could not authenticate the file manager account.');
        }

        $this->sftp = $sftp;
    }

    public function disconnect(): void
    {
        $this->sftp?->disconnect();
        $this->sftp = null;
    }

    public function listDirectory(string $path): array
    {
        $entries = $this->connection()->rawlist($path);

        if ($entries === false) {
            return [];
        }

        $rows = [];

        foreach ($entries as $name => $entry) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $rows[] = [
                'name' => $name,
                'type' => $this->typeLabel((int) ($entry['type'] ?? 0)),
                'size' => (int) ($entry['size'] ?? 0),
                'modified_at' => (int) ($entry['mtime'] ?? 0),
                'permissions' => isset($entry['permissions']) ? (int) $entry['permissions'] : null,
            ];
        }

        return $rows;
    }

    public function exists(string $path): bool
    {
        return $this->connection()->stat($path) !== false;
    }

    public function isDirectory(string $path): bool
    {
        return $this->connection()->is_dir($path);
    }

    public function putFile(string $remotePath, string $localSourcePath): bool
    {
        return $this->connection()->put($remotePath, $localSourcePath, SFTP::SOURCE_LOCAL_FILE);
    }

    public function makeDirectory(string $path): bool
    {
        return $this->connection()->mkdir($path, -1, true);
    }

    public function delete(string $path, bool $recursive): bool
    {
        return $this->connection()->delete($path, $recursive);
    }

    public function extractZip(string $zipPath, string $destinationDir): array
    {
        $sftp = $this->connection();
        // Both paths are relative to the account's own chrooted root, so this
        // works regardless of whether the zip lives inside, outside, or
        // above $destinationDir.
        $command = 'unzip -o '.$this->quote($zipPath).' -d '.$this->quote($destinationDir);

        $output = $sftp->exec($command);
        $exitStatus = $sftp->getExitStatus();

        return [
            'ok' => $exitStatus === 0,
            'message' => trim((string) $output) ?: ($exitStatus === 0 ? 'Extracted successfully.' : 'Extraction failed.'),
        ];
    }

    public function downloadToLocal(string $remotePath, string $localDestinationPath): bool
    {
        return $this->connection()->get($remotePath, $localDestinationPath) !== false;
    }

    private function connection(): SFTP
    {
        if (! $this->sftp) {
            throw new FileManagerTransportException('Not connected.');
        }

        return $this->sftp;
    }

    private function typeLabel(int $type): string
    {
        return match ($type) {
            1 => 'file',
            2 => 'dir',
            default => 'other',
        };
    }

    /** Single-quotes a value for safe use in a remote POSIX shell command. */
    private function quote(string $value): string
    {
        return "'".str_replace("'", "'\\''", $value)."'";
    }
}
