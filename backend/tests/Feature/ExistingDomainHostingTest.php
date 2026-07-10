<?php

namespace Tests\Feature;

use App\Models\Domain;
use App\Models\DomainSyncLog;
use App\Notifications\ExistingDomainDnsInstructions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/**
 * Flow 3: Hosting Only With Existing Domain — must never touch Spaceship.
 */
class ExistingDomainHostingTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    public function test_existing_domain_hosting_order_never_calls_spaceship_and_marks_domain_external(): void
    {
        $this->seed();
        ['token' => $token] = $this->registerVerifiedDomainClient('existing-domain@example.test');

        // Deliberately no domain search/verification and no register_domain flag.
        $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'my-existing-site.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $this->assertDatabaseHas('domains', [
            'domain_name' => 'my-existing-site.com',
            'source' => 'external',
            'registration_status' => null,
        ]);

        // No Spaceship call of any kind (availability, registration, etc.)
        // should ever have been logged for an existing/external domain.
        $this->assertSame(0, DomainSyncLog::count());
    }

    public function test_existing_domain_hosting_sends_dns_instructions_after_provisioning(): void
    {
        Notification::fake();
        $this->seed();
        ['token' => $token] = $this->registerVerifiedDomainClient('existing-domain-dns@example.test');

        $checkout = $this->withToken($token)->postJson('/api/v1/client/orders/hosting', [
            'plan_slug' => 'business-website-care',
            'billing_cycle' => 'annual',
            'primary_domain' => 'point-me-here.com',
            'terms_accepted' => true,
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        $domain = Domain::where('domain_name', 'point-me-here.com')->firstOrFail();
        $this->assertSame('external', $domain->source);
        $this->assertNotNull($domain->linked_hosting_service_id);

        Notification::assertSentTo($domain->client->user, ExistingDomainDnsInstructions::class);
    }
}
