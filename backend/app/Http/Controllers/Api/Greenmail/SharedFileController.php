<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Services\Greenmail\FileShares;

/** The public end of a "share securely" link: the file itself, while the link is valid. */
class SharedFileController extends Controller
{
    public function __invoke(string $token, FileShares $shares)
    {
        $file = strlen($token) === 48 ? $shares->open($token) : null;

        if (! $file) {
            return response('This link has expired or was stopped by the person who shared it.', 410, ['Content-Type' => 'text/plain; charset=utf-8']);
        }

        return response($file['content'], 200, [
            'Content-Type' => $file['mime'],
            'Content-Disposition' => 'attachment; filename="'.str_replace(['"', "\r", "\n"], '', $file['name']).'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
            'Referrer-Policy' => 'no-referrer',
        ]);
    }
}
