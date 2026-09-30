<?php

namespace App\Services\SoftwareInstall;

/**
 * Test double — records every command instead of touching a real server.
 * Tests can push canned responses via `respond()` (matched in order per
 * command prefix) or force a specific command to fail via `failOn()`.
 */
class FakeSshCommandRunner implements SshCommandRunner
{
    /** @var array<int, array{command: string, cwd: ?string}> */
    public array $executedCommands = [];

    /** @var array<string, array{exit_code: int, output: string}> */
    private array $responses = [];

    /** @var array<string, array<int, array{exit_code: int, output: string}>> */
    private array $onceResponses = [];

    public bool $connected = false;

    /** @var array<string, string> */
    public array $writtenFiles = [];

    /** @var array<int, string> */
    public array $createdDirectories = [];

    /** @var array<string, string> */
    public array $symlinks = [];

    public function connect(string $host, int $port, string $username, string $privateKey): void
    {
        $this->connected = true;
    }

    public function disconnect(): void
    {
        $this->connected = false;
    }

    public function respond(string $commandPrefix, int $exitCode, string $output = ''): void
    {
        $this->responses[$commandPrefix] = ['exit_code' => $exitCode, 'output' => $output];
    }

    /** Queues a response used for the next matching command only, ahead of respond(). */
    public function respondOnce(string $commandPrefix, int $exitCode, string $output = ''): void
    {
        $this->onceResponses[$commandPrefix][] = ['exit_code' => $exitCode, 'output' => $output];
    }

    public function failOn(string $commandPrefix, string $output = 'command failed'): void
    {
        $this->respond($commandPrefix, 1, $output);
    }

    public function exec(string $command, ?string $cwd = null): array
    {
        $this->executedCommands[] = ['command' => $command, 'cwd' => $cwd];

        foreach ($this->onceResponses as $prefix => $queued) {
            if ($queued !== [] && str_starts_with($command, $prefix)) {
                return array_shift($this->onceResponses[$prefix]);
            }
        }

        foreach ($this->responses as $prefix => $response) {
            if (str_starts_with($command, $prefix)) {
                return $response;
            }
        }

        return ['exit_code' => 0, 'output' => ''];
    }

    public function putFileContents(string $remotePath, string $contents): bool
    {
        $this->writtenFiles[$remotePath] = $contents;

        return true;
    }

    public function makeDirectory(string $path): bool
    {
        $this->createdDirectories[] = $path;

        return true;
    }

    public function symlink(string $target, string $link): bool
    {
        $this->symlinks[$link] = $target;

        return true;
    }

    public function pathExists(string $path): bool
    {
        return isset($this->writtenFiles[$path]) || in_array($path, $this->createdDirectories, true);
    }
}
