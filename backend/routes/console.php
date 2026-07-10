<?php

use App\Jobs\CheckExpiredHostingServicesJob;
use App\Jobs\DeleteExpiredIspconfigWebsiteJob;
use App\Jobs\DetectMissingIspConfigResourcesJob;
use App\Jobs\DetectOrphanedIspConfigClientsJob;
use App\Jobs\GenerateRenewalInvoiceJob;
use App\Jobs\ProcessAutoRenewalPaymentJob;
use App\Jobs\SendHostingExpiryReminderJob;
use App\Jobs\SuspendExpiredHostingJob;
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

// Auto-renewal billing pipeline — runs before the expiry pipeline so a
// successful renewal payment lands before CheckExpiredHostingServicesJob
// would otherwise flag the service as expired.
Schedule::job(new GenerateRenewalInvoiceJob)->dailyAt('02:40');
Schedule::job(new ProcessAutoRenewalPaymentJob)->dailyAt('02:45');

// Hosting expiry / grace-period / deletion pipeline (in run order).
Schedule::job(new CheckExpiredHostingServicesJob)->dailyAt('03:00');
Schedule::job(new SendHostingExpiryReminderJob)->dailyAt('03:15');
Schedule::job(new SuspendExpiredHostingJob)->dailyAt('03:30');
Schedule::job(new DeleteExpiredIspconfigWebsiteJob)->dailyAt('03:45');
