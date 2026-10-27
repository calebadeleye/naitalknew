<?php

namespace App\Console\Commands;

use App\Services\NaitalkCall\NaitalkCallUsageAlerts;
use Illuminate\Console\Command;

class NaitalkCallUsageAlertsCommand extends Command
{
    protected $signature = 'naitalk-call:usage-alerts';

    protected $description = 'Email Naitalk Call businesses that reached 80% or 100% of their monthly minutes';

    public function handle(NaitalkCallUsageAlerts $alerts): int
    {
        $this->info($alerts->check().' usage alert(s) sent.');

        return self::SUCCESS;
    }
}
