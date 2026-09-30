<?php

namespace App\Services\SoftwareInstall;

use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Net\SSH2;
use Throwable;

class RealSshCommandRunner implements SshCommandRunner
{
    private ?SSH2 $ssh = null;

    public function connect(string $host, int $port, string $username, string $privateKey): void
    {
        try {
            $ssh = new SSH2($host, $port, 10);
            $key = PublicKeyLoader::load($privateKey);
        } catch (Throwable $exception) {
            throw new SshCommandException('Could not reach the build server: '.$exception->getMessage(), 0, $exception);
        }

        if (! $ssh->login($username, $key)) {
            throw new SshCommandException('Could not authenticate the software-install build account.');
        }

        $this->ssh = $ssh;
    }

    public function disconnect(): void
    {
        $this->ssh?->disconnect();
        $this->ssh = null;
    }

    public function exec(string $command, ?string $cwd = null): array
    {
        $full = $cwd ? 'cd '.$this->quote($cwd).' && '.$command : $command;

        $output = $this->connection()->exec($full);
        $exitCode = $this->connection()->getExitStatus() ?? 1;

        return [
            'exit_code' => $exitCode,
            'output' => (string) $output,
        ];
    }

    public function putFileContents(string $remotePath, string $contents): bool
    {
        // SSH2::exec() has no stdin channel for a one-shot command, so the
        // write goes through a heredoc instead — safe because the marker is
        // random per call and the content is never interpreted as shell
        // syntax.
        $marker = 'EOF_'.bin2hex(random_bytes(8));
        $heredocCommand = 'cat > '.$this->quote($remotePath)." <<'{$marker}'\n{$contents}\n{$marker}\n";

        return $this->exec($heredocCommand)['exit_code'] === 0;
    }

    public function makeDirectory(string $path): bool
    {
        return $this->exec('mkdir -p '.$this->quote($path))['exit_code'] === 0;
    }

    public function symlink(string $target, string $link): bool
    {
        return $this->exec('ln -sfn '.$this->quote($target).' '.$this->quote($link))['exit_code'] === 0;
    }

    public function pathExists(string $path): bool
    {
        return $this->exec('test -e '.$this->quote($path))['exit_code'] === 0;
    }

    private function connection(): SSH2
    {
        if (! $this->ssh) {
            throw new SshCommandException('Not connected.');
        }

        return $this->ssh;
    }

    /** Single-quotes a value for safe use in a remote POSIX shell command. */
    private function quote(string $value): string
    {
        return "'".str_replace("'", "'\\''", $value)."'";
    }
}
