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
use App\Services\Ispconfig\FakeIspConfigClient;
use App\Services\Ispconfig\IspConfigClient;
use App\Services\Ispconfig\SoapIspConfigClient;
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
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', fn ($request) => Limit::perMinute(6)->by(strtolower((string) $request->input('email')).'|'.$request->ip()));

        RateLimiter::for('register', fn ($request) => Limit::perMinute(6)->by($request->ip()));

        RateLimiter::for('verification-resend', fn ($request) => Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('verification-code', fn ($request) => Limit::perMinute(5)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('hosting-resource-create', fn ($request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('hosting-password-reset', fn ($request) => Limit::perMinute(5)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('hosting-manual-sync', fn ($request) => Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()));

        Gate::policy(HostingService::class, HostingServicePolicy::class);
        Gate::policy(MailboxRecord::class, MailboxRecordPolicy::class);
        Gate::policy(DatabaseRecord::class, DatabaseRecordPolicy::class);
        Gate::policy(FtpAccountRecord::class, FtpAccountRecordPolicy::class);
    }
}
