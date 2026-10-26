<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\DomainPricingSettings;
use App\Models\NaitalkCallTenant;
use App\Models\NaitalkCallUsageEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    public function test_public_pricing_shows_twenty_dollars_and_the_naira_equivalent_from_the_admin_rate(): void
    {
        $this->getJson('/api/v1/public/naitalk-call/pricing')
            ->assertOk()
            ->assertJson(['monthly_usd_cents' => 2000, 'monthly_usd' => '$20', 'exchange_rate' => null, 'monthly_ngn' => null]);

        DomainPricingSettings::forProvider('spaceship')->update(['exchange_rate' => 1545.5]);

        $this->getJson('/api/v1/public/naitalk-call/pricing')
            ->assertOk()
            ->assertJson(['exchange_rate' => 1545.5, 'monthly_ngn_kobo' => 3091000, 'monthly_ngn' => '₦30,910']);
    }

    public function test_cradle_is_recorded_as_the_first_customer_with_its_key_left_on_the_server(): void
    {
        $cradle = NaitalkCallTenant::query()->where('room_prefix', 'cradle')->sole();

        $this->assertSame('server', $cradle->key_source);
        $this->assertNull($cradle->api_key);
        $this->assertSame(2000, $cradle->monthly_price_usd_cents);
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
}
