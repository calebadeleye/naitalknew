<?php

namespace App\Services\FileManager;

use App\Models\HostingService;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

/**
 * The client dashboard's File Manager. Everything is scoped to the site's
 * own "web" folder inside its dedicated, hidden file-manager account (see
 * FileManagerAccountProvisioner) — that account is a real jailkit-chrooted
 * shell user, so even a bug here can't reach another site's files; the
 * chroot is the actual backstop, this class's own path checks are defense
 * in depth on top of it.
 */
class FileManagerService
{
    private const ROOT = 'web';

    public function __construct(
        private readonly FileManagerTransport $transport,
        private readonly FileManagerAccountProvisioner $provisioner,
    ) {}

    /**
     * @return array{ready: true, path: string, entries: array<int, array<string, mixed>>}|array{ready: false}
     */
    public function list(HostingService $service, string $relativePath, bool $includeHidden): array
    {
        return $this->withConnection($service, function () use ($relativePath, $includeHidden) {
            $path = $this->resolve($relativePath);

            if (! $this->transport->isDirectory($path)) {
                throw ValidationException::withMessages(['path' => ['That folder no longer exists.']]);
            }

            $entries = collect($this->transport->listDirectory($path))
                ->when(! $includeHidden, fn ($rows) => $rows->reject(fn (array $row) => str_starts_with($row['name'], '.')))
                ->sortBy([['type', 'desc'], ['name', 'asc']])
                ->values()
                ->all();

            return ['ready' => true, 'path' => $relativePath !== '' ? trim($relativePath, '/') : '', 'entries' => $entries];
        });
    }

    public function upload(HostingService $service, string $relativeDirectory, UploadedFile $file): array
    {
        return $this->withConnection($service, function () use ($relativeDirectory, $file) {
            $dir = $this->resolve($relativeDirectory);

            if (! $this->transport->isDirectory($dir)) {
                throw ValidationException::withMessages(['path' => ['That folder no longer exists.']]);
            }

            $targetPath = rtrim($dir, '/').'/'.$file->getClientOriginalName();

            if (! $this->transport->putFile($targetPath, $file->getRealPath())) {
                throw ValidationException::withMessages(['file' => ['The upload failed. Please try again.']]);
            }

            return ['ready' => true];
        });
    }

    /**
     * @return array{ready: true, ok: bool, message: string}
     */
    public function extractZip(HostingService $service, string $relativeZipPath): array
    {
        return $this->withConnection($service, function () use ($relativeZipPath) {
            $zipPath = $this->resolve($relativeZipPath);

            if (! $this->transport->exists($zipPath) || $this->transport->isDirectory($zipPath)) {
                throw ValidationException::withMessages(['path' => ['That zip file no longer exists.']]);
            }

            if (! str_ends_with(strtolower($zipPath), '.zip')) {
                throw ValidationException::withMessages(['path' => ['Only .zip files can be extracted.']]);
            }

            $destination = dirname($zipPath);
            $result = $this->transport->extractZip($zipPath, $destination);

            return ['ready' => true, 'ok' => $result['ok'], 'message' => $result['message']];
        });
    }

    public function makeDirectory(HostingService $service, string $relativeDirectory, string $name): array
    {
        $this->assertSafeName($name);

        return $this->withConnection($service, function () use ($relativeDirectory, $name) {
            $dir = $this->resolve($relativeDirectory);

            if (! $this->transport->isDirectory($dir)) {
                throw ValidationException::withMessages(['path' => ['That folder no longer exists.']]);
            }

            $target = rtrim($dir, '/').'/'.$name;

            if ($this->transport->exists($target)) {
                throw ValidationException::withMessages(['name' => ['Something with that name already exists here.']]);
            }

            if (! $this->transport->makeDirectory($target)) {
                throw ValidationException::withMessages(['name' => ['Could not create the folder.']]);
            }

            return ['ready' => true];
        });
    }

    public function delete(HostingService $service, string $relativePath): array
    {
        return $this->withConnection($service, function () use ($relativePath) {
            $path = $this->resolve($relativePath);

            if (rtrim($path, '/') === self::ROOT) {
                throw ValidationException::withMessages(['path' => ['The site root cannot be deleted.']]);
            }

            if (! $this->transport->exists($path)) {
                throw ValidationException::withMessages(['path' => ['That no longer exists.']]);
            }

            if (! $this->transport->delete($path, true)) {
                throw ValidationException::withMessages(['path' => ['Could not delete that.']]);
            }

            return ['ready' => true];
        });
    }

    /**
     * @return array{ready: true, local_path: string}
     */
    public function prepareDownload(HostingService $service, string $relativePath): array
    {
        return $this->withConnection($service, function () use ($relativePath) {
            $path = $this->resolve($relativePath);

            if (! $this->transport->exists($path) || $this->transport->isDirectory($path)) {
                throw ValidationException::withMessages(['path' => ['That file no longer exists.']]);
            }

            $localPath = tempnam(sys_get_temp_dir(), 'nai-fm-');

            if (! $this->transport->downloadToLocal($path, $localPath)) {
                @unlink($localPath);

                throw ValidationException::withMessages(['path' => ['Could not download that file.']]);
            }

            return ['ready' => true, 'local_path' => $localPath];
        });
    }

    /**
     * Connects using the service's own hidden account, runs $action, and
     * always disconnects afterward. If the account was *just* created, the
     * real OS-level account can take a short while to actually work — that
     * isn't an error, it just means the caller should ask the client to
     * retry shortly rather than showing a failure.
     *
     * @return array<string, mixed>
     */
    private function withConnection(HostingService $service, \Closure $action): array
    {
        ['account' => $account, 'just_created' => $justCreated] = $this->provisioner->ensure($service);

        if ($justCreated) {
            return ['ready' => false];
        }

        $this->transport->connect(config('ispconfig.public_hostname'), 22, $account->username, $account->password);

        try {
            return $action();
        } finally {
            $this->transport->disconnect();
        }
    }

    private function resolve(string $relativePath): string
    {
        $relativePath = trim($relativePath, '/');
        $segments = array_filter(explode('/', $relativePath), fn ($segment) => $segment !== '' && $segment !== '.');

        foreach ($segments as $segment) {
            if ($segment === '..') {
                throw ValidationException::withMessages(['path' => ['Invalid path.']]);
            }
        }

        return self::ROOT.($segments ? '/'.implode('/', $segments) : '');
    }

    private function assertSafeName(string $name): void
    {
        if ($name === '' || $name === '.' || $name === '..' || str_contains($name, '/') || str_contains($name, "\0")) {
            throw ValidationException::withMessages(['name' => ['That is not a valid folder name.']]);
        }
    }
}
