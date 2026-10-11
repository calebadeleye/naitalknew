<?php

namespace App\Services\Ispconfig;

/**
 * Is anything accepting connections on a client app's local port? The apps
 * proxied by WebsiteSettingsService run on this same server, so a plain TCP
 * connect to loopback is enough — and cheap enough to do on every page load.
 * A class (not a bare function) so tests can say "the app is down".
 */
class ProxyPortProbe
{
    public function isListening(int $port, float $timeoutSeconds = 1.5): bool
    {
        $socket = @fsockopen('127.0.0.1', $port, $errorCode, $errorMessage, $timeoutSeconds);

        if ($socket === false) {
            return false;
        }

        fclose($socket);

        return true;
    }
}
