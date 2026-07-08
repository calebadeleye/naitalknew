<?php

use App\Jobs\DetectMissingIspConfigResourcesJob;
use App\Jobs\DetectOrphanedIspConfigClientsJob;
use App\Jobs\SyncDatabasesJob;
use App\Jobs\SyncFtpAccountsJob;
use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Jobs\SyncIspConfigClientMappingsJob;
use App\Jobs\SyncIspConfigHostingServicesJob;
use App\Jobs\SyncMailboxesJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new SyncIspConfigHostingServicesJob)->everySixHours();
Schedule::job(new SyncIspConfigClientMappingsJob)->twiceDaily(1, 13);
Schedule::job(new DetectOrphanedIspConfigClientsJob)->dailyAt('02:00');
Schedule::job(new DetectMissingIspConfigResourcesJob)->dailyAt('02:30');

Schedule::job(new SyncHostingUsageSnapshotJob)->hourly();
Schedule::job(new SyncMailboxesJob)->everySixHours();
Schedule::job(new SyncDatabasesJob)->everySixHours();
Schedule::job(new SyncFtpAccountsJob)->everySixHours();
