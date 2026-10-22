<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailSharedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * "Share securely": a copy of one attachment behind an unguessable link that
 * expires (and can be revoked, or limited to a number of downloads). The copy
 * is stored encrypted, because the link must work without the mailbox's
 * password.
 */
class FileShares
{
    private const DIRECTORY = 'greenmail-shares';

    public const MAX_ACTIVE = 50;

    /** @param  array{name: string, mime: string, content: string}  $file */
    public function create(string $owner, array $file, int $days, ?int $maxDownloads = null): GreenmailSharedFile
    {
        $path = self::DIRECTORY.'/'.Str::uuid();
        Storage::disk('local')->put($path, Crypt::encryptString($file['content']));

        return GreenmailSharedFile::query()->create([
            'owner_email' => $owner,
            'token' => Str::random(48),
            'name' => Str::limit($file['name'], 250, ''),
            'mime' => Str::limit($file['mime'], 150, ''),
            'size' => strlen($file['content']),
            'path' => $path,
            'max_downloads' => $maxDownloads,
            'expires_at' => now()->addDays(max(1, min(30, $days))),
        ]);
    }

    public function url(GreenmailSharedFile $share): string
    {
        // The API lives on the same host as the Green Mail app (…/greenmail).
        $base = Str::beforeLast(rtrim((string) config('greenmail.public_url'), '/'), '/greenmail');

        return $base.'/api/v1/greenmail/shared/'.$share->token;
    }

    /** @return array{name: string, mime: string, content: string}|null  null when the link is gone */
    public function open(string $token): ?array
    {
        $share = GreenmailSharedFile::query()->where('token', $token)->first();

        if (! $share || ! $share->isAvailable() || ! Storage::disk('local')->exists($share->path)) {
            return null;
        }

        $share->increment('downloads');

        return [
            'name' => $share->name,
            'mime' => $share->mime ?: 'application/octet-stream',
            'content' => Crypt::decryptString((string) Storage::disk('local')->get($share->path)),
        ];
    }

    public function revoke(GreenmailSharedFile $share): void
    {
        Storage::disk('local')->delete($share->path);
        $share->update(['revoked_at' => now()]);
    }

    /** Deletes the stored copies of expired / used-up / revoked links; forgets them a month later. */
    public function cleanup(): int
    {
        $removed = 0;

        GreenmailSharedFile::query()
            ->where(fn ($q) => $q->where('expires_at', '<=', now())->orWhereNotNull('revoked_at')->orWhereColumn('downloads', '>=', 'max_downloads'))
            ->chunkById(200, function ($shares) use (&$removed) {
                foreach ($shares as $share) {
                    if (Storage::disk('local')->exists($share->path)) {
                        Storage::disk('local')->delete($share->path);
                        $removed++;
                    }
                }
            });

        GreenmailSharedFile::query()->where('expires_at', '<=', now()->subDays(30))->delete();

        return $removed;
    }
}
