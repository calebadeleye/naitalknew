<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Domain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CloudflareDomainSyncCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.cloudflare.sandbox_mode' => false]);
        config(['services.cloudflare.account_id' => 'ACCOUNT-ID']);
        config(['services.cloudflare.registrar_api_token' => 'A-TOKEN']);
        config(['services.cloudflare.base_url' => 'https://cloudflare.test/client/v4']);
    }

    private function makeClient(): Client
    {
        $user = User::factory()->create();

        return Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);
    }

    private function fakeCloudflareList(array $items): void
    {
        Http::fake([
            'cloudflare.test/*' => Http::response([
                'success' => true,
                'result' => $items,
                'result_info' => ['page' => 1, 'per_page' => 50, 'count' => count($items), 'total_count' => count($items)],
            ], 200),
        ]);
    }

    public function test_importing_a_new_cloudflare_registration_creates_an_unassigned_needs_review_domain(): void
    {
        $this->fakeCloudflareList([
            ['id' => 'cf-1', 'name' => 'newly-imported.com', 'auto_renew' => true, 'expires_at' => '2027-01-01T00:00:00Z'],
        ]);

        $this->artisan('cloudflare:sync-domains')->assertSuccessful();

        $this->assertDatabaseHas('domains', [
            'domain_name' => 'newly-imported.com',
            'provider' => 'cloudflare',
            'client_id' => null,
            'ownership_assignment_status' => 'needs_review',
            'registration_source' => 'imported',
            'source' => 'cloudflare_imported',
        ]);
    }

    public function test_updating_an_existing_registration_only_touches_registrar_controlled_fields(): void
    {
        $client = $this->makeClient();
        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'already-owned.com',
            'tld' => '.com',
            'source' => 'manual',
            'provider' => 'cloudflare',
            'provider_domain_id' => 'cf-2',
            'status' => 'active',
            'ownership_assignment_status' => 'assigned',
            'customer_renewal_price_kobo' => 500000,
            'assignment_note' => 'Do not touch this note.',
            'provider_status' => 'expired',
        ]);

        $this->fakeCloudflareList([
            ['id' => 'cf-2', 'name' => 'already-owned.com', 'status' => 'active', 'auto_renew' => true, 'expires_at' => '2028-01-01T00:00:00Z'],
        ]);

        $this->artisan('cloudflare:sync-domains')->assertSuccessful();

        $domain->refresh();
        $this->assertSame($client->id, $domain->client_id);
        $this->assertSame(500000, $domain->customer_renewal_price_kobo);
        $this->assertSame('Do not touch this note.', $domain->assignment_note);
        $this->assertSame('assigned', $domain->ownership_assignment_status);
        $this->assertSame('active', $domain->provider_status);
        $this->assertSame('2028-01-01', $domain->expires_at->toDateString());
    }

    public function test_unassigned_domain_creation_never_guesses_a_customer_even_with_a_similar_name(): void
    {
        $client = $this->makeClient();
        Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'similar-name.com',
            'tld' => '.com',
            'source' => 'manual',
            'provider' => 'spaceship',
            'status' => 'active',
        ]);

        $this->fakeCloudflareList([
            ['id' => 'cf-3', 'name' => 'similar-name.net', 'auto_renew' => false],
        ]);

        $this->artisan('cloudflare:sync-domains')->assertSuccessful();

        $imported = Domain::query()->where('domain_name', 'similar-name.net')->firstOrFail();
        $this->assertNull($imported->client_id);
        $this->assertSame('needs_review', $imported->ownership_assignment_status);
    }

    public function test_a_name_match_under_a_different_existing_provider_is_skipped_not_overwritten(): void
    {
        $client = $this->makeClient();
        $existing = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'conflict.com',
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
        ]);

        $this->fakeCloudflareList([
            ['id' => 'cf-4', 'name' => 'conflict.com', 'auto_renew' => true],
        ]);

        $this->artisan('cloudflare:sync-domains')->assertSuccessful();

        $existing->refresh();
        $this->assertSame('spaceship', $existing->provider);
        $this->assertSame($client->id, $existing->client_id);
    }

    public function test_pagination_processes_every_page(): void
    {
        Http::fake([
            'cloudflare.test/*' => Http::sequence()
                ->push([
                    'success' => true,
                    'result' => [['id' => 'p1', 'name' => 'page-one.com']],
                    'result_info' => ['page' => 1, 'per_page' => 1, 'count' => 1, 'total_count' => 2],
                ], 200)
                ->push([
                    'success' => true,
                    'result' => [['id' => 'p2', 'name' => 'page-two.com']],
                    'result_info' => ['page' => 2, 'per_page' => 1, 'count' => 1, 'total_count' => 2],
                ], 200),
        ]);

        $this->artisan('cloudflare:sync-domains')->assertSuccessful();

        $this->assertDatabaseHas('domains', ['domain_name' => 'page-one.com']);
        $this->assertDatabaseHas('domains', ['domain_name' => 'page-two.com']);
    }

    public function test_dry_run_reports_proposed_changes_without_writing_to_the_database(): void
    {
        $this->fakeCloudflareList([
            ['id' => 'cf-5', 'name' => 'dry-run-only.com', 'auto_renew' => true],
        ]);

        $this->artisan('cloudflare:sync-domains', ['--dry-run' => true])->assertSuccessful();

        $this->assertDatabaseMissing('domains', ['domain_name' => 'dry-run-only.com']);
    }

    public function test_a_per_record_failure_does_not_abort_the_rest_of_the_run(): void
    {
        // A record with no `name` at all is malformed and gets normalized to
        // null by CloudflareRegistrarService, which the applier then treats
        // as skippable — the well-formed record after it must still process.
        $this->fakeCloudflareList([
            ['id' => 'no-name-here'],
            ['id' => 'cf-6', 'name' => 'still-processed.com'],
        ]);

        $this->artisan('cloudflare:sync-domains')->assertSuccessful();

        $this->assertDatabaseHas('domains', ['domain_name' => 'still-processed.com']);
    }

    public function test_repeated_runs_are_idempotent_and_do_not_duplicate_the_domain(): void
    {
        $this->fakeCloudflareList([
            ['id' => 'cf-7', 'name' => 'idempotent.com', 'auto_renew' => true],
        ]);

        $this->artisan('cloudflare:sync-domains')->assertSuccessful();
        $this->artisan('cloudflare:sync-domains')->assertSuccessful();

        $this->assertSame(1, Domain::query()->where('domain_name', 'idempotent.com')->count());
    }
}
