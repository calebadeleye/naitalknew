<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class TermsAcceptanceTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    private function registration(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Terms Client',
            'email' => 'terms-client@example.test',
            'password' => 'secret-password',
            'phone' => '08000000044',
        ], $overrides);
    }

    public function test_an_account_cannot_be_created_without_agreeing_to_the_terms(): void
    {
        $this->postJson('/api/v1/auth/register', $this->registration())
            ->assertStatus(422)
            ->assertJsonValidationErrors('terms_accepted');

        $this->assertDatabaseMissing('users', ['email' => 'terms-client@example.test']);
    }

    public function test_agreeing_at_sign_up_is_recorded_with_the_terms_version(): void
    {
        config(['legal.terms_version' => '2026-10-15']);

        $this->postJson('/api/v1/auth/register', $this->registration(['terms_accepted' => true]), ['User-Agent' => 'TermsBrowser/1.0'])->assertCreated();

        $this->assertDatabaseHas('terms_acceptances', [
            'context' => 'register',
            'version' => '2026-10-15',
            'user_agent' => 'TermsBrowser/1.0',
        ]);
    }

    public function test_a_domain_order_needs_the_terms_ticked_and_records_the_order_number(): void
    {
        $this->fakeIspConfig();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('terms-domain@example.test');
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, 'termsbiz.com');

        $this->withToken($token)->postJson('/api/v1/client/domains/orders', ['domain_name' => 'termsbiz.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('terms_accepted');

        $orderNumber = $this->withToken($token)->postJson('/api/v1/client/domains/orders', ['domain_name' => 'termsbiz.com', 'terms_accepted' => true])
            ->assertCreated()
            ->json('order.order_number');

        $this->assertDatabaseHas('terms_acceptances', ['client_id' => $client->id, 'context' => 'domain_order', 'reference' => $orderNumber]);
    }
}
