<?php

namespace App\Services\SoftwareInstall;

use phpseclib3\Crypt\PublicKeyLoader;
use phpseclib3\Net\SSH2;
use Throwable;

class RealSshCommandRunner implements SshCommandRunner
{
    private const EXIT_MARKER = '__NAITALK_EXIT';

    /**
     * Seconds one command may run. phpseclib's `$timeout` is a total budget
     * for the whole exec() call, not an idle timeout, and defaults to the
     * 10s connect timeout — enough to kill `composer install` at 99/100
     * packages. Kept under SoftwareInstallJob's own 3600s timeout.
     */
    private const COMMAND_TIMEOUT = 1800;

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
        //
        // The command's own exit code is also echoed back in-band, because
        // phpseclib's getExitStatus() returns `false` (not null) whenever the
        // server never sent an "exit-status" message for the channel — which
        // `?? 1` silently let through as a non-zero, empty "()" exit code on
        // a composer install that may well have succeeded. The in-band marker
        // is the source of truth; getExitStatus() is only a fallback.
        $ssh = $this->freshConnection();
        $output = (string) $ssh->exec($full."\nprintf '\\n".self::EXIT_MARKER.":%s\\n' \"\$?\"\n");
        $channelStatus = $ssh->getExitStatus();
        $timedOut = $ssh->isTimeout();
        $ssh->disconnect();

        if (preg_match('/\R?'.self::EXIT_MARKER.':(\d+)\R?$/', $output, $matches, PREG_OFFSET_CAPTURE)) {
            return [
                'exit_code' => (int) $matches[1][0],
                'output' => substr($output, 0, $matches[0][1]),
            ];
        }

        if ($timedOut) {
            return [
                'exit_code' => -1,
                'output' => $output."\n[The command did not finish within ".self::COMMAND_TIMEOUT." seconds and was abandoned.]",
            ];
        }

        // No marker means the shell never reached the end of the command —
        // it was killed (e.g. by the build account's resource cap) or the
        // connection dropped mid-run. Never report that as success.
        if (is_int($channelStatus)) {
            return ['exit_code' => $channelStatus, 'output' => $output];
        }

        return [
            'exit_code' => -1,
            'output' => $output."\n[The command ended without reporting an exit status — the process was likely killed (memory/CPU cap) or the SSH connection dropped.]",
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

        // Login used the short connect timeout above; commands get their own.
        $ssh->setTimeout(self::COMMAND_TIMEOUT);

        $this->ssh = $ssh;

        return $ssh;
    }

    /** Single-quotes a value for safe use in a remote POSIX shell command. */
    private function quote(string $value): string
    {
        return "'".str_replace("'", "'\\''", $value)."'";
    }
}
