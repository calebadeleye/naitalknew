<?php

namespace Tests\Concerns;

use App\Models\Client;
use App\Models\DomainContact;
use App\Models\DomainPricing;
use App\Models\User;

trait CreatesDomainFixtures
{
    private function registerVerifiedDomainClient(string $email): array
    {
        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Domain Test Client',
            'email' => $email,
            'password' => 'secret-password',
            'phone' => '08000000099',
        ])->assertCreated()->json('token');

        $user = User::query()->where('email', $email)->firstOrFail();
        $user->forceFill(['email_verified_at' => now()])->save();

        return ['token' => $token, 'client' => Client::query()->where('user_id', $user->id)->firstOrFail()];
    }

    private function domainAdminToken(): string
    {
        $this->app['auth']->forgetGuards();

        return $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@naitalk.com',
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    /**
     * DomainPricing seeds as 'needs_review' by default — activate a row so
     * DomainPricingService::priceFor() actually returns a price.
     *
     * registration_price_kobo/etc. here represent the already-converted NGN
     * cost basis (matching DomainPricingService's expectations), so
     * exchange_rate_to_ngn is just set to a non-null marker (1) to satisfy
     * DomainPricing::hasUsableCostBasis() — it's a readiness flag, not
     * re-applied to these already-NGN figures anywhere in the pricing calc.
     */
    private function activateDomainPricing(string $tld = '.com', array $overrides = []): DomainPricing
    {
        return DomainPricing::query()->updateOrCreate(
            ['tld' => $tld],
            array_merge([
                'provider' => 'spaceship',
                'currency' => 'NGN',
                'exchange_rate_to_ngn' => 1,
                'registration_price_kobo' => 1_500_000,
                'renewal_price_kobo' => 1_500_000,
                'transfer_price_kobo' => 1_000_000,
                'markup_type' => 'cost_plus_markup',
                'markup_value_kobo' => 800_000,
                'fixed_customer_price_kobo' => null,
                'status' => 'active',
            ], $overrides)
        );
    }

    private function completeDomainContact(Client $client): DomainContact
    {
        return DomainContact::query()->updateOrCreate(
            ['client_id' => $client->id],
            [
                'full_name' => 'Domain Test Client',
                'company_name' => 'NAI TALK Test Co',
                'email' => 'domain-contact@example.test',
                'phone' => '08000000099',
                'address' => '7, Unity Rd',
                'city' => 'Lagos',
                'state' => 'Lagos',
                'country' => 'Nigeria',
                'postal_code' => '100001',
            ]
        );
    }

    /**
     * Primes SpaceshipDomainAvailabilityService's "recently verified" cache
     * so a subsequent order/transfer request is allowed to proceed.
     */
    private function verifyDomainAvailable(string $token, string $domain): void
    {
        $this->withToken($token)->getJson('/api/v1/public/domains/search?domain='.urlencode($domain))
            ->assertOk()
            ->assertJson(['available' => true]);
    }
}
