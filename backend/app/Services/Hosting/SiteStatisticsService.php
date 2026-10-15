<?php

namespace App\Services\Hosting;

use App\Models\HostingService;
use App\Models\SiteMetricDaily;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Copies a website's daily visitor figures out of its AWStats report.
 *
 * ISPConfig builds the report every night from the site's Apache access log
 * into web/stats/ (current month) and web/stats/YYYY-M/ (earlier months),
 * behind a password for the user "admin". We give each site its own random
 * stats password (set through ISPConfig, kept encrypted here) and fetch the
 * report from Apache on this same server, so a domain whose DNS points
 * elsewhere (e.g. through Cloudflare) still works.
 */
class SiteStatisticsService
{
    public function __construct(private readonly IspConfigClient $ispConfig)
    {
    }

    /**
     * @return int|null days stored, or null when the report could not be read
     */
    public function sync(HostingService $service, ?Carbon $today = null): ?int
    {
        $today ??= now();
        $months = [$today->copy()->startOfMonth()];

        // Early in a month, also pick up the last days of the previous one
        // (AWStats only finalises them on the night after).
        if ($today->day <= 3) {
            $months[] = $today->copy()->subMonthNoOverflow()->startOfMonth();
        }

        $stored = null;

        foreach ($months as $month) {
            $html = $this->fetchReport($service, $month, current: $month->isSameMonth($today));

            if ($html === null) {
                continue;
            }

            $days = collect(AwstatsReportParser::days($html))->filter(fn (array $day) => $day['date'] <= $today->toDateString());

            foreach ($days as $day) {
                $row = SiteMetricDaily::query()->where('hosting_service_id', $service->id)->whereDate('date', $day['date'])->first()
                    ?? new SiteMetricDaily(['hosting_service_id' => $service->id, 'date' => $day['date']]);
                $row->fill(array_diff_key($day, ['date' => true]))->save();
            }

            $stored = ($stored ?? 0) + $days->count();
        }

        if ($stored !== null) {
            $service->forceFill(['stats_synced_at' => now()])->save();
        }

        return $stored;
    }

    private function fetchReport(HostingService $service, Carbon $month, bool $current): ?string
    {
        $domain = $service->primary_domain;
        $password = $this->password($service);

        if (! $domain || ! $password) {
            return null;
        }

        $path = $current ? '/stats/awsindex.html' : "/stats/{$month->year}-{$month->month}/awsindex.html";
        $scheme = $service->website_ssl_active ? 'https' : 'http';
        $port = $scheme === 'https' ? 443 : 80;

        $request = Http::withBasicAuth('admin', $password)->timeout(20);

        if (config('hosting_lifecycle.stats_fetch_via_loopback', true)) {
            // Talk to Apache on this machine directly. Certificate checks are
            // pointless (and fail for expired certs) when the traffic never
            // leaves the server.
            $request = $request->withOptions([
                'curl' => [CURLOPT_RESOLVE => ["{$domain}:{$port}:127.0.0.1"]],
                'verify' => false,
            ]);
        }

        $response = rescue(fn () => $request->get("{$scheme}://{$domain}{$path}"), report: false);

        return $response && $response->successful() && stripos($response->body(), 'awstats') !== false ? $response->body() : null;
    }

    /** The site's stats password, created (and set in ISPConfig) the first time it's needed. */
    private function password(HostingService $service): ?string
    {
        if ($service->stats_password) {
            return Crypt::decryptString($service->stats_password);
        }

        $mapping = $service->ispConfigServiceMappings()->with('clientMapping')->whereNotNull('ispconfig_website_id')->first();

        if (! $mapping?->clientMapping) {
            return null;
        }

        $password = Str::password(24, symbols: false);
        $sessionId = $this->ispConfig->login();

        try {
            $this->ispConfig->sitesWebDomainUpdate($sessionId, (int) $mapping->clientMapping->ispconfig_client_id, (int) $mapping->ispconfig_website_id, [
                'stats_password' => $password,
            ]);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        $service->forceFill(['stats_password' => Crypt::encryptString($password)])->save();

        // ISPConfig writes the new .htpasswd on its next cron run (~1 minute),
        // so this first sync usually finds nothing; the next one will.
        return $password;
    }

    /**
     * The last $days days (oldest first, zero-filled) plus totals and the
     * equivalent period before, for the client's Statistics tab.
     */
    public function summary(HostingService $service, int $days = 30): array
    {
        $end = now()->subDay()->startOfDay();
        $start = $end->copy()->subDays($days - 1);
        $previousStart = $start->copy()->subDays($days);

        $rows = SiteMetricDaily::query()
            ->where('hosting_service_id', $service->id)
            ->whereDate('date', '>=', $previousStart->toDateString())
            ->whereDate('date', '<=', $end->toDateString())
            ->get()
            ->keyBy(fn (SiteMetricDaily $row) => $row->date->toDateString());

        $series = collect(range(0, $days - 1))->map(function (int $offset) use ($start, $rows) {
            $date = $start->copy()->addDays($offset)->toDateString();
            $row = $rows->get($date);

            return [
                'date' => $date,
                'visits' => (int) ($row->visits ?? 0),
                'pages' => (int) ($row->pages ?? 0),
                'bandwidth_bytes' => (int) ($row->bandwidth_bytes ?? 0),
            ];
        });

        $previous = $rows->filter(fn (SiteMetricDaily $row) => $row->date->lt($start));

        return [
            'days' => $series->values()->all(),
            'totals' => [
                'visits' => $series->sum('visits'),
                'pages' => $series->sum('pages'),
                'bandwidth_bytes' => $series->sum('bandwidth_bytes'),
            ],
            'previous_totals' => [
                'visits' => (int) $previous->sum('visits'),
                'pages' => (int) $previous->sum('pages'),
            ],
            'last_updated' => $service->stats_synced_at?->toIso8601String(),
            'has_data' => $series->sum('visits') > 0 || $series->sum('bandwidth_bytes') > 0,
        ];
    }

    /** This calendar month's traffic in MB from the stats, for when ISPConfig's own counter reads 0. */
    public static function bandwidthThisMonthMb(HostingService $service): int
    {
        $bytes = SiteMetricDaily::query()
            ->where('hosting_service_id', $service->id)
            ->whereDate('date', '>=', now()->startOfMonth()->toDateString())
            ->whereDate('date', '<=', now()->toDateString())
            ->sum('bandwidth_bytes');

        return (int) ceil($bytes / 1048576);
    }
}
