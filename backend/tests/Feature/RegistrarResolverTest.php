<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Domain;
use App\Models\User;
use App\Services\Domains\Registrars\CloudflareRegistrarService;
use App\Services\Domains\Registrars\RegistrarResolver;
use App\Services\Domains\Registrars\SpaceshipRegistrarAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrarResolverTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_resolves_spaceship_provider_to_the_spaceship_adapter(): void
    {
        $resolver = app(RegistrarResolver::class);

        $this->assertInstanceOf(SpaceshipRegistrarAdapter::class, $resolver->resolveForProvider('spaceship'));
    }

    public function test_resolves_cloudflare_provider_to_the_cloudflare_service(): void
    {
        $resolver = app(RegistrarResolver::class);

        $this->assertInstanceOf(CloudflareRegistrarService::class, $resolver->resolveForProvider('cloudflare'));
    }

    public function test_unknown_or_null_provider_falls_back_to_spaceship(): void
    {
        $resolver = app(RegistrarResolver::class);

        $this->assertInstanceOf(SpaceshipRegistrarAdapter::class, $resolver->resolveForProvider(null));
        $this->assertInstanceOf(SpaceshipRegistrarAdapter::class, $resolver->resolveForProvider('some_unrecognized_provider'));
    }

    public function test_resolve_reads_the_domains_own_provider_column(): void
    {
        $client = $this->makeClient();
        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'cloudflare-owned.com',
            'tld' => '.com',
            'source' => 'manual',
            'provider' => 'cloudflare',
            'status' => 'active',
        ]);

        $resolved = app(RegistrarResolver::class)->resolve($domain);

        $this->assertInstanceOf(CloudflareRegistrarService::class, $resolved);
    }

    public function test_nigerian_tlds_never_support_instant_registration(): void
    {
        $resolver = app(RegistrarResolver::class);

        $this->assertFalse($resolver->supportsInstantRegistration('.ng'));
        $this->assertFalse($resolver->supportsInstantRegistration('.com.ng'));
        $this->assertFalse($resolver->supportsInstantRegistration('.org.ng'));
        $this->assertFalse($resolver->supportsInstantRegistration('.net.ng'));
        $this->assertTrue($resolver->supportsInstantRegistration('.com'));
    }
}
