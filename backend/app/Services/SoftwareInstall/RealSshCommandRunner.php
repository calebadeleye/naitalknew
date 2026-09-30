<?php

namespace App\Services\SoftwareInstall;

use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Net\SSH2;
use Throwable;

class RealSshCommandRunner implements SshCommandRunner
{
    private ?string $host = null;

    private int $port = 22;

    private ?string $username = null;

    private ?string $privateKey = null;

    private ?SSH2 $ssh = null;

    public function connect(string $host, int $port, string $username, string $privateKey): void
    {
        $this->host = $host;
        $this->port = $port;
        $this->username = $username;
        $this->privateKey = $privateKey;

        // Establishes the connection once up front purely to fail fast with
        // a clear error if the account/host/key is wrong — exec() below
        // never reuses this handle (see its own comment for why).
        $this->freshConnection();
    }

    public function disconnect(): void
    {
        $this->ssh?->disconnect();
        $this->ssh = null;
    }

    public function exec(string $command, ?string $cwd = null): array
    {
        $full = $cwd ? 'cd '.$this->quote($cwd).' && '.$command : $command;

        // phpseclib3's SSH2::exec() always reuses a single fixed channel
        // slot for non-shell commands. A long-output command (composer
        // install's progress output was enough to trigger this in testing)
        // can leave that channel marked open internally even though the
        // remote command finished, and the *next* exec() then throws
        // "Please close the channel (1) before trying to open it again" —
        // confirmed against a real install run. A fresh connection per
        // command sidesteps the whole class of bug; the reconnect overhead
        // (a few hundred ms) is negligible next to how long each of these
        // build/deploy commands actually takes.
        $ssh = $this->freshConnection();
        $output = $ssh->exec($full);
        $exitCode = $ssh->getExitStatus() ?? 1;
        $ssh->disconnect();

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

    private function freshConnection(): SSH2
    {
        if (! $this->host || ! $this->username || $this->privateKey === null) {
            throw new SshCommandException('Not connected.');
        }

        try {
            $ssh = new SSH2($this->host, $this->port, 10);
            $key = PublicKeyLoader::load($this->privateKey);
        } catch (Throwable $exception) {
            throw new SshCommandException('Could not reach the build server: '.$exception->getMessage(), 0, $exception);
        }

        if (! $ssh->login($this->username, $key)) {
            throw new SshCommandException('Could not authenticate the software-install build account.');
        }

        $this->ssh = $ssh;

        return $ssh;
    }

    /** Single-quotes a value for safe use in a remote POSIX shell command. */
    private function quote(string $value): string
    {
        return "'".str_replace("'", "'\\''", $value)."'";
    }
}
