<?php

namespace App\Services\Ispconfig;

use App\Services\Ispconfig\Exceptions\IspConfigApiException;

class IspConfigHealthCheckService
{
    public function __construct(private readonly IspConfigClient $client)
    {
    }

    /**
     * Attempts a login/logout round-trip against ISPConfig. Throws on
     * failure — callers decide how much detail to surface (CLI output vs.
     * an HTTP response) via the exception's getMessage()/safeMessage().
     *
     * @throws IspConfigApiException
     */
    public function check(): void
    {
        $sessionId = $this->client->login();
        $this->client->logout($sessionId);
    }
}
