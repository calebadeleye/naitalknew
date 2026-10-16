<?php

namespace App\Providers;

use App\Models\DatabaseRecord;
use App\Models\FtpAccountRecord;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use App\Policies\DatabaseRecordPolicy;
use App\Policies\FtpAccountRecordPolicy;
use App\Policies\HostingServicePolicy;
use App\Policies\MailboxRecordPolicy;
use App\Services\Greenmail\FakeMailGateway;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\WebklexMailGateway;
use App\Services\Ispconfig\FakeIspConfigClient;
use App\Services\Ispconfig\IspConfigClient;
use App\Services\Ispconfig\SoapIspConfigClient;
use App\Services\FileManager\FakeFileManagerTransport;
use App\Services\FileManager\FileManagerTransport;
use App\Services\FileManager\Phpseclib3FileManagerTransport;
use App\Services\SoftwareInstall\FakeSshCommandRunner;
use App\Services\SoftwareInstall\RealSshCommandRunner;
use App\Services\SoftwareInstall\SshCommandRunner;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One IMAP connection per request, shared by the middleware that opens
        // it and the controller that uses it.
        $this->app->scoped(MailGateway::class, fn ($app) => $app->environment('testing') ? new FakeMailGateway : new WebklexMailGateway);

        $this->app->bind(IspConfigClient::class, function ($app) {
            if ($app->environment('testing')) {
                return $app->make(FakeIspConfigClient::class);
            }

            $config = $app['config']->get('ispconfig');

            return new SoapIspConfigClient(
                host: $config['host'],
                port: $config['port'],
                remoteUser: $config['remote_user'],
                remotePassword: $config['remote_password'],
                verifySsl: $config['verify_ssl'],
            );
        });

        $this->app->bind(FileManagerTransport::class, function ($app) {
            return $app->environment('testing') ? new FakeFileManagerTransport : new Phpseclib3FileManagerTransport;
        });

        $this->app->bind(SshCommandRunner::class, function ($app) {
            return $app->environment('testing') ? new FakeSshCommandRunner : new RealSshCommandRunner;
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Embed only the glyphs a PDF actually uses. Every invoice/receipt uses
        // DejaVu Sans (for the ₦ sign), and embedding the whole font made a
        // one-page receipt ~890 KB; subset, it's ~35 KB and looks identical.
        // Set here rather than by publishing config/dompdf.php, which would
        // freeze every other package default.
        config(['dompdf.options.enable_font_subsetting' => true]);

        RateLimiter::for('login', fn ($request) => Limit::perMinute(6)->by(strtolower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('register', fn ($request) => Limit::perMinute(6)->by($request->ip()));

        RateLimiter::for('verification-resend', fn ($request) => Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('verification-code', fn ($request) => Limit::perMinute(5)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('hosting-resource-create', fn ($request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('hosting-password-reset', fn ($request) => Limit::perMinute(5)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('hosting-manual-sync', fn ($request) => Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()));

        // Mailbox passwords: few attempts per address, and per IP across addresses.
        RateLimiter::for('greenmail-login', fn ($request) => [
            Limit::perMinute(5)->by('gm-login|'.strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(20)->by('gm-login-ip|'.$request->ip()),
        ]);
        RateLimiter::for('greenmail-send', fn ($request) => Limit::perMinute(20)->by('gm-send|'.$request->header('X-Greenmail-Token')));
        RateLimiter::for('greenmail-assistant', fn ($request) => Limit::perMinute(15)->by('gm-ai|'.$request->header('X-Greenmail-Token')));

        RateLimiter::for('support-ticket', fn ($request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('website-quote', fn ($request) => Limit::perMinute(5)->by($request->ip()));

        RateLimiter::for('tracking', fn ($request) => Limit::perMinute(60)->by($request->ip()));

        Gate::policy(HostingService::class, HostingServicePolicy::class);
        Gate::policy(MailboxRecord::class, MailboxRecordPolicy::class);
        Gate::policy(DatabaseRecord::class, DatabaseRecordPolicy::class);
        Gate::policy(FtpAccountRecord::class, FtpAccountRecordPolicy::class);
    }
}
