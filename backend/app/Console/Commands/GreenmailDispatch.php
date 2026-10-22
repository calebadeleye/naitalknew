<?php

namespace App\Console\Commands;

use App\Services\Greenmail\Campaigns;
use App\Services\Greenmail\FileShares;
use App\Services\Greenmail\FollowUps;
use App\Services\Greenmail\ScheduledSends;
use Illuminate\Console\Command;

/**
 * Every minute: "Send later" emails that are due, the next few campaign
 * emails, snoozed emails whose time has come, "nobody replied" reminders,
 * and expired share links.
 */
class GreenmailDispatch extends Command
{
    protected $signature = 'greenmail:dispatch';

    protected $description = 'Send scheduled Green Mail emails and campaigns, return snoozed emails, check reminders';

    public function handle(ScheduledSends $scheduled, Campaigns $campaigns, FollowUps $followUps, FileShares $shares): int
    {
        $this->info('Scheduled sent: '.$scheduled->sendDue());
        $this->info('Campaign emails sent: '.$campaigns->sendDue());
        $this->info('Snoozed emails returned: '.$followUps->returnDue());
        $this->info('Reminders due: '.$followUps->checkDue());
        $this->info('Share links cleaned up: '.$shares->cleanup());

        return self::SUCCESS;
    }
}
