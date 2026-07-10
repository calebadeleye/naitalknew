<?php

namespace Tests\Feature;

use App\Models\Domain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\TestCase;

class DomainAuthorizationTest extends TestCase
{
    use CreatesDomainFixtures, RefreshDatabase;

    private function createDomainFor(string $email, string $domainName): Domain
    {
        ['client' => $client] = $this->registerVerifiedDomainClient($email);

        return Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => $domainName,
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
            'registration_status' => 'registered',
            'auto_renew' => true,
        ]);
    }

    public function test_a_client_only_sees_their_own_domains_in_their_dashboard_listing(): void
    {
        $domainA = $this->createDomainFor('domain-owner-a@example.test', 'clienta-domain.com');
        $this->createDomainFor('domain-owner-b@example.test', 'clientb-domain.com');

        $tokenA = $this->postJson('/api/v1/auth/login', [
            'email' => 'domain-owner-a@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('token');

        $response = $this->withToken($tokenA)->getJson('/api/v1/client/domains')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('clienta-domain.com'));
        $this->assertFalse($names->contains('clientb-domain.com'));
    }

    public function test_a_client_cannot_view_another_clients_domain_by_id(): void
    {
        $this->createDomainFor('domain-victim@example.test', 'victim-domain.com');
        $domainB = $this->createDomainFor('domain-attacker@example.test', 'attacker-domain.com');

        $tokenAttacker = $this->postJson('/api/v1/auth/login', [
            'email' => 'domain-attacker@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('token');

        $victimDomain = Domain::where('domain_name', 'victim-domain.com')->firstOrFail();

        $this->withToken($tokenAttacker)->getJson("/api/v1/client/domains/{$victimDomain->id}")->assertStatus(403);
        // Sanity check: the attacker can see their own domain fine.
        $this->withToken($tokenAttacker)->getJson("/api/v1/client/domains/{$domainB->id}")->assertOk();
    }

    public function test_admin_can_see_domains_across_every_client(): void
    {
        $this->seed();
        $this->createDomainFor('admin-view-a@example.test', 'admin-visible-a.com');
        $this->createDomainFor('admin-view-b@example.test', 'admin-visible-b.com');

        $adminToken = $this->domainAdminToken();

        $response = $this->withToken($adminToken)->getJson('/api/v1/admin/domains')->assertOk();
        $names = collect($response->json('data'))->pluck('domain_name');

        $this->assertTrue($names->contains('admin-visible-a.com'));
        $this->assertTrue($names->contains('admin-visible-b.com'));
    }
}
