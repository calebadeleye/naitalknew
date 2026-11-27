<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Cloudflare Turnstile: checks the token the sign-up form's widget produced. */
class Turnstile
{
    public static function enabled(): bool
    {
        return filled(config('services.turnstile.secret_key')) && filled(config('services.turnstile.site_key'));
    }

    public static function verify(?string $token, ?string $ip = null): bool
    {
        if (! self::enabled()) {
            return true;
        }
        if (! $token) {
            return false;
        }

        try {
            $response = Http::asForm()->timeout(8)->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', array_filter([
                'secret' => config('services.turnstile.secret_key'),
                'response' => $token,
                'remoteip' => $ip,
            ]));
        } catch (Throwable $exception) {
            // Cloudflare unreachable: let the person through rather than block every sign-up.
            Log::warning('Turnstile verification unavailable', ['error' => $exception->getMessage()]);

            return true;
        }

        if ($response->failed()) {
            Log::warning('Turnstile verification unavailable', ['status' => $response->status()]);

            return true;
        }

        return (bool) $response->json('success');
    }
}
