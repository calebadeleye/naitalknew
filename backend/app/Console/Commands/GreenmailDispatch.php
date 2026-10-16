<?php

namespace App\Console\Commands;

use App\Services\Greenmail\Campaigns;
use App\Services\Greenmail\ScheduledSends;
use Illuminate\Console\Command;

/** Every minute: "Send later" emails that are due, then the next few campaign emails. */
class GreenmailDispatch extends Command
{
    protected $signature = 'greenmail:dispatch';

    protected $description = 'Send scheduled Green Mail emails and the next batch of campaign emails';

    public function handle(ScheduledSends $scheduled, Campaigns $campaigns): int
    {
        $this->info('Scheduled sent: '.$scheduled->sendDue());
        $this->info('Campaign emails sent: '.$campaigns->sendDue());

        return self::SUCCESS;
    }
}
