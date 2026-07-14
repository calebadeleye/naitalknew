<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Domain;
use App\Models\User;
use App\Services\Domains\Registrars\Data\DomainOperationStatus;
use App\Services\Domains\Registrars\Data\DomainRegistrationData;
use App\Services\Domains\Registrars\SpaceshipRegistrarAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SpaceshipRegistrarAdapterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.spaceship.sandbox_mode' => true]);
        Http::fake();
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

    private function makeDomain(): Domain
    {
        return Domain::query()->create([
            'client_id' => $this->makeClient()->id,
            'domain_name' => 'adapter-test.com',
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
            'registration_status' => 'registered',
            'auto_renew' => true,
        ]);
    }

    public function test_check_availability_matches_the_existing_client_behavior(): void
    {
        $result = app(SpaceshipRegistrarAdapter::class)->checkAvailability('dryrun-example.com');

        $this->assertTrue($result->available);
        $this->assertSame('dryrun-example.com', $result->domain);
    }

    public function test_renew_delegates_to_the_existing_renewal_service_and_updates_expiry(): void
    {
        $domain = $this->makeDomain();

        $result = app(SpaceshipRegistrarAdapter::class)->renew($domain->domain_name, 1);

        $this->assertTrue($result->successful);
        $this->assertSame(DomainOperationStatus::Completed, $result->status);
        $this->assertSame('active', $domain->fresh()->status);
    }

    public function test_get_and_set_auto_renew_read_and_write_the_local_column_directly(): void
    {
        $domain = $this->makeDomain();
        $adapter = app(SpaceshipRegistrarAdapter::class);

        $this->assertTrue($adapter->getAutoRenew($domain->domain_name));

        $result = $adapter->setAutoRenew($domain->domain_name, false);

        $this->assertTrue($result->successful);
        $this->assertFalse($domain->fresh()->auto_renew);
        $this->assertFalse($adapter->getAutoRenew($domain->domain_name));

        // No live Spaceship call should ever be involved in this — mirrors
        // today's exact behavior for Spaceship domains.
        Http::assertNothingSent();
    }

    public function test_register_returns_a_clear_requires_attention_result_rather_than_being_callable_live(): void
    {
        $result = app(SpaceshipRegistrarAdapter::class)->register(
            new DomainRegistrationData(domainName: 'never-really-registered.com')
        );

        $this->assertFalse($result->successful);
        $this->assertSame(DomainOperationStatus::RequiresAttention, $result->status);
    }

    public function test_list_registrations_returns_an_empty_exhausted_page(): void
    {
        $page = app(SpaceshipRegistrarAdapter::class)->listRegistrations();

        $this->assertSame([], $page->items);
        $this->assertFalse($page->hasMore);
    }
}
