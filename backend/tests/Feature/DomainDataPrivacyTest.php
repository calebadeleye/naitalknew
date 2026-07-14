<?php

namespace Tests\Feature;

use App\Models\Domain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * Consolidated sweep across every client-facing domain endpoint (index and
 * show) confirming the full "never expose" list from the spec: registrar
 * account/credential fields, provider cost, markup, raw API metadata, and
 * internal admin notes.
 */
class DomainDataPrivacyTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    private const FORBIDDEN_KEYS = [
        'provider_domain_id',
        'provider_order_id',
        'provider_cost_minor',
        'provider_currency',
        'provider_metadata',
        'assignment_note',
        'assigned_by',
        'assigned_at',
        'markup_amount_kobo',
        'markup_type',
        'gross_profit_estimate_kobo',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    public function test_client_domain_index_and_show_never_expose_registrar_or_internal_fields(): void
    {
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('privacy-sweep@example.test');

        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'privacysweep.com',
            'tld' => '.com',
            'source' => 'cloudflare_imported',
            'registration_source' => 'imported',
            'provider' => 'cloudflare',
            'provider_domain_id' => 'cf-secret-id',
            'provider_order_id' => 'cf-secret-order',
            'provider_cost_minor' => 999999,
            'provider_currency' => 'USD',
            'status' => 'active',
            'ownership_assignment_status' => 'assigned',
            'assignment_note' => 'Never let the client see this internal note.',
            'provider_metadata' => ['nameservers' => ['ns1.cloudflare.com'], 'secret_internal_field' => 'should-not-leak'],
        ]);

        $indexResponse = $this->withToken($token)->getJson('/api/v1/client/domains')->assertOk();
        $showResponse = $this->withToken($token)->getJson("/api/v1/client/domains/{$domain->id}")->assertOk();

        foreach ([$indexResponse->json('data.0'), $showResponse->json()] as $payload) {
            foreach (self::FORBIDDEN_KEYS as $forbiddenKey) {
                $this->assertArrayNotHasKey($forbiddenKey, $payload, "\"{$forbiddenKey}\" must never appear in a client-facing domain payload.");
            }

            // provider_metadata's raw content (beyond the curated
            // nameservers/dns_status subset) must never leak either.
            $this->assertStringNotContainsString('should-not-leak', json_encode($payload));
            $this->assertStringNotContainsString('Never let the client see this internal note', json_encode($payload));
        }
    }
}
