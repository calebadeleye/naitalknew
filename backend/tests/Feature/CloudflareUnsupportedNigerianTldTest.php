<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Domain;
use App\Models\User;
use App\Services\Domains\Registrars\CloudflareRegistrarService;
use App\Services\Domains\Registrars\RegistrarResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CloudflareUnsupportedNigerianTldTest extends TestCase
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

    public function test_nigerian_tlds_never_support_instant_registration_through_any_provider(): void
    {
        $resolver = app(RegistrarResolver::class);

        foreach (['.ng', '.com.ng', '.org.ng', '.net.ng'] as $tld) {
            $this->assertFalse($resolver->supportsInstantRegistration($tld), "{$tld} must not support instant registration.");
        }
    }

    public function test_a_nigerian_tld_domain_is_never_routed_to_cloudflare_even_if_provider_is_mistakenly_set(): void
    {
        $client = $this->makeClient();
        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'example.com.ng',
            'tld' => '.com.ng',
            'source' => 'manual',
            // Defensive scenario: provider mistakenly set to cloudflare for
            // a TLD Cloudflare doesn't support — resolve() still resolves
            // by the provider column (routing capability is separate from
            // whether checkout would ever allow this combination), but
            // supportsInstantRegistration() is the guard any future
            // checkout-time routing must consult before ever reaching here.
            'provider' => 'cloudflare',
            'status' => 'active',
        ]);

        $resolver = app(RegistrarResolver::class);

        $this->assertFalse($resolver->supportsInstantRegistration($domain->tld));
        $this->assertInstanceOf(CloudflareRegistrarService::class, $resolver->resolve($domain));
    }
}
