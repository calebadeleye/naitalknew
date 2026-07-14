<?php

namespace Tests\Feature;

use App\Models\Domain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class ClientDomainDashboardCloudflareTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    private function makeCloudflareDomain(string $email, string $domainName): array
    {
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient($email);

        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => $domainName,
            'tld' => '.com',
            'source' => 'cloudflare_imported',
            'registration_source' => 'imported',
            'provider' => 'cloudflare',
            'provider_domain_id' => 'cf-'.$domainName,
            'status' => 'active',
            'ownership_assignment_status' => 'assigned',
            'auto_renew' => true,
            'registrar_operation_status' => 'pending',
            'payment_status' => 'paid',
            'expires_at' => now()->addDays(60),
            'provider_metadata' => ['nameservers' => ['ns1.cloudflare.com', 'ns2.cloudflare.com'], 'dns_status' => 'active'],
            'assignment_note' => 'Internal note that must never reach the client.',
            'provider_cost_minor' => 123456,
            'provider_currency' => 'USD',
        ]);

        return ['token' => $token, 'domain' => $domain];
    }

    public function test_client_domain_payload_includes_the_new_fields(): void
    {
        ['token' => $token, 'domain' => $domain] = $this->makeCloudflareDomain('cf-client-fields@example.test', 'cfclientfields.com');

        $response = $this->withToken($token)->getJson("/api/v1/client/domains/{$domain->id}")->assertOk();

        $response->assertJsonPath('nameservers', ['ns1.cloudflare.com', 'ns2.cloudflare.com']);
        $response->assertJsonPath('dns_status', 'active');
        $response->assertJsonPath('payment_status', 'paid');
        $response->assertJsonPath('registrar_operation_status_label', 'Renewal in progress');
        $this->assertIsArray($response->json('renewal_history'));
    }

    public function test_provider_label_reads_managed_by_naitalk_not_cloudflare(): void
    {
        ['token' => $token, 'domain' => $domain] = $this->makeCloudflareDomain('cf-client-label@example.test', 'cfclientlabel.com');

        $response = $this->withToken($token)->getJson("/api/v1/client/domains/{$domain->id}")->assertOk();

        $response->assertJsonPath('provider_label', 'Managed by NAI TALK');
        $response->assertJsonMissing(['provider_label' => 'Cloudflare']);
    }

    public function test_sensitive_provider_and_internal_fields_never_appear_in_the_client_payload(): void
    {
        ['token' => $token, 'domain' => $domain] = $this->makeCloudflareDomain('cf-client-privacy@example.test', 'cfclientprivacy.com');

        $response = $this->withToken($token)->getJson("/api/v1/client/domains/{$domain->id}")->assertOk();
        $payload = $response->json();

        foreach (['provider_domain_id', 'provider_cost_minor', 'provider_currency', 'provider_metadata', 'assignment_note', 'assigned_by', 'markup_amount_kobo'] as $forbiddenKey) {
            $this->assertArrayNotHasKey($forbiddenKey, $payload, "Client payload must never include \"{$forbiddenKey}\".");
        }
    }
}
