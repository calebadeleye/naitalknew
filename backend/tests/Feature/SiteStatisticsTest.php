<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingService;
use App\Models\SiteMetricDaily;
use App\Services\Hosting\AwstatsReportParser;
use App\Services\Hosting\SiteStatisticsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class SiteStatisticsTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    /** A trimmed AWStats "Days of month" table, as ISPConfig's static report prints it. */
    private function report(array $rows): string
    {
        $html = '<html><head><meta name="generator" content="AWStats 7.8"></head><body><table class="aws_data">';
        foreach ($rows as [$date, $visits, $pages, $hits, $bandwidth]) {
            $html .= "<tr><td>{$date}</td><td>{$visits}</td><td>{$pages}</td><td>{$hits}</td><td>{$bandwidth}</td></tr>";
        }

        return $html.'</table></body></html>';
    }

    private function site(): HostingService
    {
        $fake = $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    public function test_the_parser_reads_awstats_day_rows_including_thousands_and_units(): void
    {
        $days = AwstatsReportParser::days($this->report([
            ['30 Jun 2026', '685', '1,514', '2,370', '159.43 MB'],
            ['29 Jun 2026', '17', '25', '35', '30.32 KB'],
            ['28 Jun 2026', '0', '0', '0', '0'],
        ]));

        $this->assertCount(3, $days);
        $this->assertSame(['date' => '2026-06-30', 'visits' => 685, 'pages' => 1514, 'hits' => 2370, 'bandwidth_bytes' => (int) round(159.43 * 1048576)], $days[0]);
        $this->assertSame((int) round(30.32 * 1024), $days[1]['bandwidth_bytes']);
        $this->assertSame(0, $days[2]['visits']);
        $this->assertSame((int) round(1.5 * 1073741824), AwstatsReportParser::bytes('1.5 GB'));
    }

    public function test_sync_sets_a_stats_password_in_ispconfig_fetches_the_report_and_stores_each_day_once(): void
    {
        $service = $this->site();
        Carbon::setTestNow('2026-10-15 06:20:00');
        Http::fake(['*/stats/awsindex.html' => Http::response($this->report([
            ['13 Oct 2026', '40', '90', '200', '2.00 MB'],
            ['14 Oct 2026', '55', '120', '260', '3.00 MB'],
            ['31 Oct 2026', '0', '0', '0', '0'], // future rows AWStats prints are ignored
        ]))]);

        $statistics = app(SiteStatisticsService::class);
        $this->assertSame(2, $statistics->sync($service));
        $this->assertSame(2, $statistics->sync($service->fresh()), 'a second run updates, it does not duplicate');

        $this->assertSame(2, SiteMetricDaily::where('hosting_service_id', $service->id)->count());
        $this->assertSame(55, SiteMetricDaily::where('hosting_service_id', $service->id)->whereDate('date', '2026-10-14')->value('visits'));

        $password = Crypt::decryptString($service->fresh()->stats_password);
        $this->assertSame(24, strlen($password));
        Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Basic '.base64_encode('admin:'.$password)));
        $this->assertNotNull($service->fresh()->stats_synced_at);
        $this->assertArrayNotHasKey('stats_password', $service->fresh()->toArray(), 'never serialised to the browser');
    }

    public function test_early_in_the_month_the_previous_months_report_is_read_too(): void
    {
        $service = $this->site();
        Carbon::setTestNow('2026-11-02 06:20:00');
        Http::fake([
            '*/stats/awsindex.html' => Http::response($this->report([['01 Nov 2026', '5', '9', '20', '100 KB']])),
            '*/stats/2026-10/awsindex.html' => Http::response($this->report([['31 Oct 2026', '7', '11', '30', '200 KB']])),
        ]);

        app(SiteStatisticsService::class)->sync($service);

        $this->assertEqualsCanonicalizing(['2026-10-31', '2026-11-01'], SiteMetricDaily::pluck('date')->map->toDateString()->all());
    }

    public function test_a_report_that_cannot_be_read_stores_nothing(): void
    {
        $service = $this->site();
        Http::fake(['*' => Http::response('Unauthorized', 401)]);

        $this->assertNull(app(SiteStatisticsService::class)->sync($service));
        $this->assertSame(0, SiteMetricDaily::count());
        $this->assertNull($service->fresh()->stats_synced_at);
    }

    public function test_the_client_sees_a_zero_filled_30_day_series_with_totals(): void
    {
        $service = $this->site();
        Carbon::setTestNow('2026-10-15 09:00:00');
        SiteMetricDaily::query()->create(['hosting_service_id' => $service->id, 'date' => '2026-10-14', 'visits' => 55, 'pages' => 120, 'hits' => 260, 'bandwidth_bytes' => 3145728]);
        SiteMetricDaily::query()->create(['hosting_service_id' => $service->id, 'date' => '2026-09-01', 'visits' => 10, 'pages' => 20, 'hits' => 40, 'bandwidth_bytes' => 1024]);

        $user = $service->client->user;
        $user->forceFill(['password' => Hash::make('secret-password')])->save();
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])->assertOk()->json('token');

        $response = $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/statistics")->assertOk();

        $response->assertJsonCount(30, 'days')
            ->assertJsonPath('days.29.date', '2026-10-14')
            ->assertJsonPath('days.29.visits', 55)
            ->assertJsonPath('days.0.visits', 0)
            ->assertJsonPath('totals.visits', 55)
            ->assertJsonPath('previous_totals.visits', 10)
            ->assertJsonPath('has_data', true);
    }

    public function test_bandwidth_falls_back_to_the_statistics_when_ispconfig_reports_nothing(): void
    {
        $service = $this->site();
        Carbon::setTestNow('2026-10-15 09:00:00');
        SiteMetricDaily::query()->create(['hosting_service_id' => $service->id, 'date' => '2026-10-02', 'visits' => 1, 'pages' => 1, 'hits' => 1, 'bandwidth_bytes' => 5 * 1048576]);
        SiteMetricDaily::query()->create(['hosting_service_id' => $service->id, 'date' => '2026-09-30', 'visits' => 1, 'pages' => 1, 'hits' => 1, 'bandwidth_bytes' => 50 * 1048576]);

        $this->assertSame(5, SiteStatisticsService::bandwidthThisMonthMb($service));
    }
}
