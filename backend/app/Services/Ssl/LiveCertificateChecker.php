<?php

namespace App\Services\Ssl;

use Illuminate\Support\Carbon;

/**
 * The ground truth for "does this site actually have working SSL": connects
 * to the domain over TLS itself and checks what certificate is really being
 * served, rather than trusting ISPConfig's own record of it.
 *
 * This exists because ISPConfig's remote API does not reliably return
 * certificate data for Let's Encrypt-issued certificates (confirmed against
 * a live site with a valid, working certificate whose `ssl_cert` field came
 * back empty over SOAP) — so a field-based check would wrongly tell a client
 * their working site has no SSL. The same live check also caught a site
 * whose auto-renewal had silently failed for weeks while ISPConfig's own
 * "SSL enabled" flag still read true.
 */
class LiveCertificateChecker
{
    /**
     * @return array{active: bool, expires_at: ?Carbon}
     */
    public function check(string $domain, int $timeoutSeconds = 4): array
    {
        $parsed = $this->handshake($domain, $timeoutSeconds);

        if ($parsed === null) {
            return ['active' => false, 'expires_at' => null];
        }

        $expiresAt = isset($parsed['validTo_time_t']) ? Carbon::createFromTimestamp((int) $parsed['validTo_time_t']) : null;
        $active = $expiresAt !== null && $expiresAt->isFuture() && $this->certificateCoversDomain($domain, $parsed);

        return ['active' => $active, 'expires_at' => $expiresAt];
    }

    public function isActive(string $domain, int $timeoutSeconds = 4): bool
    {
        return $this->check($domain, $timeoutSeconds)['active'];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function handshake(string $domain, int $timeoutSeconds): ?array
    {
        $context = stream_context_create(['ssl' => [
            'capture_peer_cert' => true,
            'verify_peer' => false,
            'verify_peer_name' => false,
            'peer_name' => $domain,
        ]]);

        $errno = 0;
        $errstr = '';
        $client = @stream_socket_client("ssl://{$domain}:443", $errno, $errstr, $timeoutSeconds, STREAM_CLIENT_CONNECT, $context);

        if (! $client) {
            return null;
        }

        try {
            $params = stream_context_get_params($client);
            $cert = $params['options']['ssl']['peer_certificate'] ?? null;

            if (! $cert) {
                return null;
            }

            $parsed = openssl_x509_parse($cert);

            return is_array($parsed) ? $parsed : null;
        } finally {
            fclose($client);
        }
    }

    /**
     * @param  array<string, mixed>  $parsed
     */
    private function certificateCoversDomain(string $domain, array $parsed): bool
    {
        $names = [];

        if (! empty($parsed['subject']['CN'])) {
            $names[] = (string) $parsed['subject']['CN'];
        }

        foreach (explode(',', (string) ($parsed['extensions']['subjectAltName'] ?? '')) as $entry) {
            $entry = trim($entry);

            if (str_starts_with($entry, 'DNS:')) {
                $names[] = substr($entry, 4);
            }
        }

        $domain = strtolower($domain);

        foreach ($names as $name) {
            $pattern = '/^'.str_replace('\*', '[^.]+', preg_quote(strtolower($name), '/')).'$/';

            if (@preg_match($pattern, $domain) === 1) {
                return true;
            }
        }

        return false;
    }
}
