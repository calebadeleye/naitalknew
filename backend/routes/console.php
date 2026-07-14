<?php

use App\Console\Commands\SyncCloudflareDomainsCommand;
use App\Jobs\CheckExpiredHostingServicesJob;
use App\Jobs\DeleteExpiredIspconfigWebsiteJob;
use App\Jobs\DetectMissingIspConfigResourcesJob;
use App\Jobs\DetectOrphanedIspConfigClientsJob;
use App\Jobs\GenerateRenewalInvoiceJob;
use App\Jobs\ProcessAutoRenewalPaymentJob;
use App\Jobs\RenewDomainJob;
use App\Jobs\SendDomainExpiryReminderJob;
use App\Jobs\SendHostingExpiryReminderJob;
use App\Jobs\SuspendExpiredHostingJob;
use App\Jobs\SyncDatabasesJob;
use App\Jobs\SyncDomainStatusJob;
use App\Jobs\SyncFtpAccountsJob;
use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Jobs\SyncIspConfigClientMappingsJob;
use App\Jobs\SyncIspConfigHostingServicesJob;
use App\Jobs\SyncMailboxesJob;
use App\Jobs\SyncSpaceshipTldPricesJob;
use App\Models\DomainPricingSettings;
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

// Domain lifecycle: transfer/expiry status sync, auto-renewal billing, expiry reminders.
Schedule::job(new SyncDomainStatusJob)->everySixHours();
Schedule::job(new RenewDomainJob)->dailyAt('02:35');
Schedule::job(new SendDomainExpiryReminderJob)->dailyAt('03:50');

// Cloudflare Registrar import/sync — off by default (auto_sync_enabled
// defaults false, same safety posture as the Spaceship TLD price sync
// below) until an admin explicitly turns it on for the cloudflare provider.
Schedule::command(SyncCloudflareDomainsCommand::class)
    ->dailyAt('05:15')
    ->when(fn (): bool => (bool) DomainPricingSettings::forProvider('cloudflare')->auto_sync_enabled);

// TLD price sync — checked daily but only actually dispatches on the day
// matching the admin's configured cadence, so switching between weekly and
// monthly needs no code change and never syncs more often than requested.
Schedule::job(new SyncSpaceshipTldPricesJob('scheduled'))
    ->dailyAt('04:10')
    ->when(function (): bool {
        $settings = DomainPricingSettings::forProvider('spaceship');

        if (! $settings->auto_sync_enabled) {
            return false;
        }

        return match ($settings->sync_frequency) {
            'weekly' => now()->isSunday(),
            'monthly' => now()->day === 1,
            default => false,
        };
    });
