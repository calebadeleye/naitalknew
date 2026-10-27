<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Client;
use App\Models\User;
use App\Notifications\NaitalkCallUsageWarning;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use App\Models\NaitalkCallTenant;
use App\Models\NaitalkCallUsageEvent;
use App\Services\NaitalkCall\CbnExchangeRate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\TestCase;

class NaitalkCallTest extends TestCase
{
    use CreatesDomainFixtures, RefreshDatabase;

    private const SYNC_TOKEN = 'sync-token-for-tests';

    protected function setUp(): void
    {
        parent::setUp();
        config(['naitalk_call.sync_token' => self::SYNC_TOKEN]);
    }

    public function test_public_pricing_lists_every_plan_with_naira_at_the_cbn_official_rate(): void
    {
        $plans = $this->getJson('/api/v1/public/naitalk-call/pricing')->assertOk()->assertJsonPath('exchange_rate', null)->json('plans');
        $this->assertSame(['free', 'starter', 'growth', 'business'], array_column($plans, 'id'));
        $this->assertSame(['Free', '$20', '$49', '$99'], array_column($plans, 'monthly_usd'));
        $this->assertSame([5000, 50000, 200000, 500000], array_column($plans, 'included_minutes'));
        $this->assertNull($plans[1]['monthly_ngn'], 'no Naira price before the first CBN fetch');

        AppSetting::put(CbnExchangeRate::SETTING, ['rate' => 1367.1057, 'date' => '2026-10-26', 'source' => 'CBN', 'fetched_at' => now()->toIso8601String()]);

        $response = $this->getJson('/api/v1/public/naitalk-call/pricing')->assertOk()->assertJsonPath('exchange_rate.date', '2026-10-26');
        $this->assertSame([null, '₦27,342', '₦66,988', '₦135,343'], array_column($response->json('plans'), 'monthly_ngn'));
    }

    public function test_the_cbn_rate_is_the_newest_us_dollar_central_rate(): void
    {
        Http::fake(['*' => Http::sequence()
            ->push([
                ['id' => 3, 'currency' => 'EURO', 'ratedate' => '2026-10-26', 'buyingrate' => '1590.1', 'centralrate' => '1590.6', 'sellingrate' => '1591.1'],
                ['id' => 2, 'currency' => 'US DOLLAR', 'ratedate' => '2026-10-23', 'buyingrate' => '1360.8394', 'centralrate' => '1361.3394', 'sellingrate' => '1361.8394'],
                ['id' => 1, 'currency' => 'US DOLLAR', 'ratedate' => '2026-10-26', 'buyingrate' => '1366.6057', 'centralrate' => '1367.1057', 'sellingrate' => '1367.6057'],
            ])
            // Then a broken table: the last good rate stays.
            ->push([['currency' => 'US DOLLAR', 'ratedate' => '2026-10-27', 'centralrate' => '0']]),
        ]);

        $this->artisan('naitalk-call:fetch-cbn-rate')->assertSuccessful();
        $this->assertSame(['rate' => 1367.1057, 'date' => '2026-10-26', 'source' => 'CBN'], array_intersect_key(app(CbnExchangeRate::class)->current(), array_flip(['rate', 'date', 'source'])));

        $this->artisan('naitalk-call:fetch-cbn-rate')->assertFailed();
        $this->assertSame('2026-10-26', app(CbnExchangeRate::class)->current()['date']);
    }

    public function test_cradle_is_recorded_as_the_first_customer_with_its_key_left_on_the_server(): void
    {
        $cradle = NaitalkCallTenant::query()->where('room_prefix', 'cradle')->sole();

        $this->assertSame('server', $cradle->key_source);
        $this->assertNull($cradle->api_key);
        $this->assertSame('free', $cradle->plan);
        $this->assertSame(0, $cradle->monthly_price_usd_cents);
    }

    public function test_choosing_a_plan_sets_its_price(): void
    {
        $this->seed();
        $admin = $this->domainAdminToken();
        AppSetting::put(CbnExchangeRate::SETTING, ['rate' => 1500, 'date' => '2026-10-26', 'source' => 'CBN']);

        $free = $this->withToken($admin)->postJson('/api/v1/admin/naitalk-call/tenants', ['business_name' => 'Tester', 'room_prefix' => 'tester', 'plan' => 'free'])
            ->assertCreated();
        $this->assertSame('Free', $free->json('data.monthly_price_usd'));
        $this->assertNull($free->json('data.monthly_price_ngn'));
        $this->assertNotEmpty($free->json('api_secret'));

        $id = $free->json('data.id');
        $paid = $this->withToken($admin)->putJson("/api/v1/admin/naitalk-call/tenants/$id", ['business_name' => 'Tester', 'room_prefix' => 'tester', 'plan' => 'growth'])->assertOk();
        $this->assertSame('$49', $paid->json('data.monthly_price_usd'));
        $this->assertSame('₦73,500', $paid->json('data.monthly_price_ngn'));
        $this->assertSame(200000, $paid->json('data.included_minutes'));

        // Saving other fields keeps the plan's price.
        $this->withToken($admin)->putJson("/api/v1/admin/naitalk-call/tenants/$id", ['business_name' => 'Tester Ltd', 'room_prefix' => 'tester'])
            ->assertOk()->assertJsonPath('data.monthly_price_usd', '$49');

        $plans = $this->withToken($admin)->getJson('/api/v1/admin/naitalk-call/tenants')->json('plans');
        $this->assertSame(['free', 'starter', 'growth', 'business'], array_column($plans, 'id'));

        // Free tenants still get keys on the server.
        config(['naitalk_call.sync_token' => self::SYNC_TOKEN]);
        $this->withToken($admin)->putJson("/api/v1/admin/naitalk-call/tenants/$id", ['business_name' => 'Tester', 'room_prefix' => 'tester', 'plan' => 'free'])->assertOk();
        $this->assertCount(1, $this->withToken(self::SYNC_TOKEN)->getJson('/api/v1/internal/naitalk-call/config')->json('keys'));
    }

    public function test_admin_onboards_a_business_and_sees_the_secret_once(): void
    {
        $this->seed();
        $admin = $this->domainAdminToken();

        $created = $this->withToken($admin)->postJson('/api/v1/admin/naitalk-call/tenants', [
            'business_name' => 'Acme Clinics',
            'contact_email' => 'ops@acme.test',
            'room_prefix' => 'acme',
            'webhook_url' => 'https://api.acme.test/livekit',
        ])->assertCreated();

        $key = $created->json('data.api_key');
        $secret = $created->json('api_secret');
        $this->assertMatchesRegularExpression('/^nc[a-z0-9]{14}$/', $key);
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{48}$/', $secret);
        $this->assertSame('active', $created->json('data.status'));
        $this->assertSame('$20', $created->json('data.monthly_price_usd'));

        $list = $this->withToken($admin)->getJson('/api/v1/admin/naitalk-call/tenants')->assertOk();
        $this->assertStringNotContainsString($secret, $list->getContent());
        $this->assertSame(['Acme Clinics', 'Cradle'], collect($list->json('data'))->pluck('business_name')->all());

        // Secrets are encrypted at rest.
        $this->assertNotSame($secret, \DB::table('naitalk_call_tenants')->where('api_key', $key)->value('api_secret'));

        $this->withToken($admin)->postJson('/api/v1/admin/naitalk-call/tenants', ['business_name' => 'Copycat', 'room_prefix' => 'acme'])
            ->assertStatus(422)->assertJsonValidationErrors('room_prefix');
        $this->withToken($admin)->postJson('/api/v1/admin/naitalk-call/tenants', ['business_name' => 'Bad', 'room_prefix' => 'Bad Prefix!'])
            ->assertStatus(422)->assertJsonValidationErrors('room_prefix');
    }

    public function test_rotating_a_key_replaces_it_but_cradles_server_key_cannot_be_rotated_here(): void
    {
        $this->seed();
        $admin = $this->domainAdminToken();
        $tenant = NaitalkCallTenant::query()->create(['business_name' => 'Acme', 'room_prefix' => 'acme']);
        $tenant->issueKey();
        $oldKey = $tenant->api_key;

        $rotated = $this->withToken($admin)->postJson("/api/v1/admin/naitalk-call/tenants/{$tenant->id}/rotate-key")->assertOk();
        $this->assertNotSame($oldKey, $rotated->json('data.api_key'));
        $this->assertNotEmpty($rotated->json('api_secret'));

        $cradle = NaitalkCallTenant::query()->where('room_prefix', 'cradle')->sole();
        $this->withToken($admin)->postJson("/api/v1/admin/naitalk-call/tenants/{$cradle->id}/rotate-key")->assertStatus(422);
        $this->assertNull($cradle->fresh()->api_key);
    }

    public function test_internal_endpoints_refuse_requests_without_the_sync_token(): void
    {
        $this->getJson('/api/v1/internal/naitalk-call/config')->assertUnauthorized();
        $this->withToken('wrong')->getJson('/api/v1/internal/naitalk-call/config')->assertUnauthorized();
        $this->withToken('wrong')->postJson('/api/v1/internal/naitalk-call/events', [])->assertUnauthorized();

        config(['naitalk_call.sync_token' => null]);
        $this->withToken('')->getJson('/api/v1/internal/naitalk-call/config')->assertUnauthorized();
    }

    public function test_server_config_has_only_active_managed_keys_and_every_webhook_route(): void
    {
        $acme = NaitalkCallTenant::query()->create(['business_name' => 'Acme', 'room_prefix' => 'acme', 'webhook_url' => 'https://acme.test/hook']);
        $acmeSecret = $acme->issueKey();
        $gone = NaitalkCallTenant::query()->create(['business_name' => 'Gone', 'room_prefix' => 'gone', 'status' => 'suspended']);
        $gone->issueKey();

        $response = $this->withToken(self::SYNC_TOKEN)->getJson('/api/v1/internal/naitalk-call/config')->assertOk();

        $this->assertSame([$acme->api_key => $acmeSecret], $response->json('keys'));
        $routes = collect($response->json('routes'))->keyBy('prefix');
        $this->assertSame(['cradle', 'acme'], $routes->keys()->all());
        // Cradle keeps LiveKit's own signature; Acme's events are re-signed with its key.
        $this->assertNull($routes['cradle']['api_key']);
        $this->assertSame('http://127.0.0.1:4300/v1/calls/webhook', $routes['cradle']['url']);
        $this->assertSame($acmeSecret, $routes['acme']['api_secret']);

        $this->withToken(self::SYNC_TOKEN)->postJson('/api/v1/internal/naitalk-call/synced', ['status' => 'deferred', 'message' => '2 rooms live'])->assertOk();
        $this->assertSame('deferred', AppSetting::get('naitalk_call_last_sync')['status']);
    }

    public function test_participant_left_events_are_metered_once_per_business(): void
    {
        $acme = NaitalkCallTenant::query()->create(['business_name' => 'Acme', 'room_prefix' => 'acme']);
        $acmeLabs = NaitalkCallTenant::query()->create(['business_name' => 'Acme Labs', 'room_prefix' => 'acme-labs']);
        $now = now()->timestamp;

        $event = fn (string $id, string $room, int $seconds) => [
            'event' => 'participant_left',
            'id' => $id,
            // LiveKit sends int64 fields as strings.
            'createdAt' => (string) $now,
            'room' => ['name' => $room, 'sid' => 'RM_1'],
            'participant' => ['identity' => 'user-1', 'joinedAt' => (string) ($now - $seconds)],
        ];

        $send = fn (array $body) => $this->withToken(self::SYNC_TOKEN)->postJson('/api/v1/internal/naitalk-call/events', $body);

        $send($event('EV_1', 'cradle-call-42', 125))->assertOk();
        $send($event('EV_1', 'cradle-call-42', 125))->assertOk(); // retried delivery
        $send($event('EV_2', 'acme-room-1', 60))->assertOk();
        $send($event('EV_3', 'acme-labs-standup', 30))->assertOk();
        $send($event('EV_4', 'stranger-room', 30))->assertStatus(202);
        $send(['event' => 'room_started', 'id' => 'EV_5', 'room' => ['name' => 'acme-x']])->assertStatus(202);

        $this->assertSame(3, NaitalkCallUsageEvent::query()->count());
        $this->assertSame(60, (int) NaitalkCallUsageEvent::query()->where('tenant_id', $acme->id)->sum('seconds'));
        $this->assertSame(30, (int) NaitalkCallUsageEvent::query()->where('tenant_id', $acmeLabs->id)->sum('seconds'));

        $this->seed();
        $admin = $this->domainAdminToken();
        $rows = collect($this->withToken($admin)->getJson('/api/v1/admin/naitalk-call/tenants')->json('data'))->keyBy('room_prefix');
        $this->assertSame(3, $rows['cradle']['minutes_this_month']); // 125s rounds up
        $this->assertSame(1, $rows['acme']['minutes_this_month']);
    }

    private function clientWithUser(string $email): Client
    {
        $user = User::factory()->create(['role' => 'client', 'email' => $email]);

        return Client::query()->create([
            'user_id' => $user->id, 'client_code' => 'CLT-'.strtoupper(substr(md5($email), 0, 8)), 'account_type' => 'billing_client',
            'client_status' => 'active', 'status' => 'active', 'billing_email' => $email, 'company_name' => 'Acme Ltd', 'country' => 'Nigeria',
        ]);
    }

    private function usage(NaitalkCallTenant $tenant, int $minutes, string $id): void
    {
        NaitalkCallUsageEvent::query()->create([
            'tenant_id' => $tenant->id, 'event_id' => $id, 'room_name' => $tenant->room_prefix.'-room', 'participant_identity' => 'u1',
            'seconds' => $minutes * 60, 'left_at' => now(),
        ]);
    }

    public function test_admin_links_a_business_to_a_client_account_by_email(): void
    {
        $this->seed();
        $admin = $this->domainAdminToken();
        $client = $this->clientWithUser('owner@acme.test');
        $tenant = NaitalkCallTenant::query()->create(['business_name' => 'Acme', 'room_prefix' => 'acme', 'plan' => 'starter']);

        $this->withToken($admin)->putJson("/api/v1/admin/naitalk-call/tenants/{$tenant->id}", ['business_name' => 'Acme', 'room_prefix' => 'acme', 'client_email' => 'nobody@acme.test'])
            ->assertStatus(422)->assertJsonValidationErrors('client_email');
        $this->withToken($admin)->putJson("/api/v1/admin/naitalk-call/tenants/{$tenant->id}", ['business_name' => 'Acme', 'room_prefix' => 'acme', 'client_email' => 'owner@acme.test'])
            ->assertOk()->assertJsonPath('data.client.id', $client->id);
        // Saving without client_email keeps the link; null removes it.
        $this->withToken($admin)->putJson("/api/v1/admin/naitalk-call/tenants/{$tenant->id}", ['business_name' => 'Acme Ltd', 'room_prefix' => 'acme'])
            ->assertOk()->assertJsonPath('data.client.id', $client->id);
        $this->withToken($admin)->putJson("/api/v1/admin/naitalk-call/tenants/{$tenant->id}", ['business_name' => 'Acme Ltd', 'room_prefix' => 'acme', 'client_email' => null])
            ->assertOk()->assertJsonPath('data.client', null);
    }

    public function test_clients_see_their_usage_dashboard_and_report_but_never_the_secret(): void
    {
        $client = $this->clientWithUser('owner@acme.test');
        $tenant = NaitalkCallTenant::query()->create(['business_name' => 'Acme', 'room_prefix' => 'acme', 'plan' => 'starter', 'client_id' => $client->id]);
        $secret = $tenant->issueKey();
        $this->usage($tenant, 12_500, 'EV_A');
        $other = NaitalkCallTenant::query()->create(['business_name' => 'Other', 'room_prefix' => 'other', 'plan' => 'growth']);

        Sanctum::actingAs($client->user, [], 'sanctum');
        $response = $this->getJson('/api/v1/client/naitalk-call')->assertOk();
        $this->assertStringNotContainsString($secret, $response->getContent());
        $this->assertSame(['Acme'], array_column($response->json('data'), 'business_name'));
        $response->assertJsonPath('data.0.usage.minutes', 12500)
            ->assertJsonPath('data.0.usage.included_minutes', 50000)
            ->assertJsonPath('data.0.usage.percent', 25)
            ->assertJsonPath('data.0.plan.monthly_usd', '$20')
            ->assertJsonPath('data.0.connection.api_key', $tenant->api_key)
            ->assertJsonPath('data.0.connection.url', 'wss://call.naitalk.com');
        $this->assertSame(12500, collect($response->json('data.0.daily'))->sum('minutes'));
        $this->assertSame(12500, $response->json('data.0.monthly.0.minutes'));

        $csv = $this->get("/api/v1/client/naitalk-call/{$tenant->id}/report?month=".now()->format('Y-m'))->assertOk()->streamedContent();
        $this->assertStringContainsString('acme-room,u1,750000,12500', $csv);
        $this->assertStringContainsString('total,,,750000,12500', $csv);
        $this->get("/api/v1/client/naitalk-call/{$other->id}/report")->assertNotFound();

        $this->getJson('/api/v1/client/dashboard')->assertOk()->assertJsonPath('has_naitalk_call', true);
    }

    public function test_usage_alerts_go_out_once_per_level_on_plans_that_have_them(): void
    {
        Notification::fake();
        $client = $this->clientWithUser('owner@grow.test');
        $growth = NaitalkCallTenant::query()->create(['business_name' => 'Grow', 'room_prefix' => 'grow', 'plan' => 'growth', 'client_id' => $client->id]);
        $starter = NaitalkCallTenant::query()->create(['business_name' => 'Small', 'room_prefix' => 'small', 'plan' => 'starter', 'contact_email' => 'ops@small.test']);
        $unlinked = NaitalkCallTenant::query()->create(['business_name' => 'Big', 'room_prefix' => 'big', 'plan' => 'business', 'contact_email' => 'ops@big.test']);
        $this->usage($growth, 170_000, 'EV_G1'); // 85%
        $this->usage($starter, 60_000, 'EV_S1'); // 120%, but Starter has no alerts
        $this->usage($unlinked, 600_000, 'EV_B1'); // 120%

        $this->artisan('naitalk-call:usage-alerts')->expectsOutput('2 usage alert(s) sent.')->assertSuccessful();
        Notification::assertSentTo($client->user, NaitalkCallUsageWarning::class, fn ($n) => $n->level === 80 && $n->usedMinutes === 170000);
        Notification::assertSentOnDemand(NaitalkCallUsageWarning::class, fn ($n, $channels, $notifiable) => $n->level === 100 && $notifiable->routes['mail'] === 'ops@big.test');

        // Nothing new: no repeat.
        $this->artisan('naitalk-call:usage-alerts')->expectsOutput('0 usage alert(s) sent.');

        // Growth passes 100%: the 100% alert goes out once.
        $this->usage($growth, 40_000, 'EV_G2');
        $this->artisan('naitalk-call:usage-alerts')->expectsOutput('1 usage alert(s) sent.');
        Notification::assertSentTo($client->user, NaitalkCallUsageWarning::class, fn ($n) => $n->level === 100);
        $this->assertDatabaseHas('notification_logs', ['client_id' => $client->id, 'template' => "naitalk_call_usage_{$growth->id}_100_".now()->format('Y-m')]);
    }
}
