<?php

namespace Tests\Feature;

use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class IspConfigHealthCheckTest extends TestCase
{
    use FakesIspConfig, RefreshDatabase;

    public function test_health_check_command_succeeds_when_login_works(): void
    {
        $this->fakeIspConfig();

        $this->artisan('ispconfig:health-check')
            ->expectsOutputToContain('ISPConfig health check OK')
            ->assertExitCode(0);
    }

    public function test_health_check_command_fails_when_login_throws(): void
    {
        $fake = $this->fakeIspConfig();
        $fake->shouldFail('login', new IspConfigApiException('ISPConfig is not configured.'));

        $this->artisan('ispconfig:health-check')
            ->expectsOutputToContain('ISPConfig health check FAILED')
            ->assertExitCode(1);
    }
}
