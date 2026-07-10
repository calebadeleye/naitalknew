<?php

namespace Tests\Feature;

use App\Jobs\RegisterDomainWithSpaceshipJob;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\DomainSyncLog;
use App\Services\Domains\DomainOrderDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class DuplicateDomainRegistrationTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    private function createPaidDomainOrder(string $email, string $domainName): DomainOrder
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient($email);
        $this->completeDomainContact($client);
        $this->verifyDomainAvailable($token, $domainName);

        $checkout = $this->withToken($token)->postJson('/api/v1/client/domains/orders', [
            'domain_name' => $domainName,
        ])->assertCreated();

        $invoiceNumber = $checkout->json('invoice.invoice_number');

        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        return DomainOrder::where('domain_name', $domainName)->firstOrFail();
    }

    public function test_running_the_registration_job_twice_for_the_same_domain_order_registers_only_once(): void
    {
        Notification::fake();
        $domainOrder = $this->createPaidDomainOrder('dup-job@example.test', 'runtwice.com');
        $domain = $domainOrder->domain;

        $this->assertSame('registered', $domain->fresh()->registration_status);
        $this->assertSame(1, DomainSyncLog::where('action', 'register_domain')->count());

        // A retried queue job for the same, already-registered domain order.
        app()->call([new RegisterDomainWithSpaceshipJob($domainOrder->id), 'handle']);

        $domain->refresh();
        $this->assertSame('registered', $domain->registration_status);
        // SpaceshipDomainRegistrationService::register() short-circuits for an
        // already-registered domain before ever calling the Spaceship client again.
        $this->assertSame(1, DomainSyncLog::where('action', 'register_domain')->count());
    }

    public function test_dispatcher_does_not_redispatch_a_domain_order_that_is_already_processing_or_completed(): void
    {
        $domainOrder = $this->createPaidDomainOrder('dup-dispatch@example.test', 'onlyonce.com');
        $this->assertSame('completed', $domainOrder->fresh()->status);

        $invoice = $domainOrder->invoice;
        $dispatcher = app(DomainOrderDispatcher::class);

        // Re-run the same dispatch that ReconcileInvoicePaymentService triggers
        // on every paid invoice — a completed domain order must be left alone.
        $dispatcher->dispatchForPaidInvoice($invoice->fresh(), collect());

        $domainOrder->refresh();
        $this->assertSame('completed', $domainOrder->status);
        $this->assertSame(1, DomainSyncLog::where('action', 'register_domain')->count());
    }

    public function test_registering_an_already_registered_domain_is_a_no_op_even_via_a_second_pending_order(): void
    {
        $domainOrder = $this->createPaidDomainOrder('dup-domain@example.test', 'secondorder.com');
        $domain = $domainOrder->domain->fresh();
        $this->assertSame('registered', $domain->registration_status);

        // Simulate a second registration order somehow existing for the same,
        // already-registered domain (e.g. a stale duplicate request).
        $secondOrder = DomainOrder::query()->create([
            'client_id' => $domain->client_id,
            'domain_id' => $domain->id,
            'domain_name' => $domain->domain_name,
            'order_type' => 'registration',
            'provider' => 'spaceship',
            'status' => 'processing',
            'price_kobo' => 100,
            'vat_amount_kobo' => 0,
            'total_amount_kobo' => 100,
        ]);

        app()->call([new RegisterDomainWithSpaceshipJob($secondOrder->id), 'handle']);

        $domain->refresh();
        $this->assertSame('registered', $domain->registration_status);
        $this->assertSame(1, DomainSyncLog::where('action', 'register_domain')->count());
    }
}
