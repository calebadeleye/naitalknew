<?php

namespace App\Console\Commands;

use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\IspConfigHealthCheckService;
use Illuminate\Console\Command;

class IspConfigHealthCheckCommand extends Command
{
    protected $signature = 'ispconfig:health-check';

    protected $description = 'Test the configured ISPConfig Remote API connection (login/logout round-trip).';

    public function handle(IspConfigHealthCheckService $healthCheck): int
    {
        $this->info('Checking ISPConfig connection using config/ispconfig.php...');

        try {
            $healthCheck->check();
        } catch (IspConfigApiException $exception) {
            $this->error('ISPConfig health check FAILED: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info('ISPConfig health check OK: login/logout succeeded.');

        return self::SUCCESS;
    }
}
