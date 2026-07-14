<?php

namespace Tests\Feature;

use App\Jobs\RenewDomainJob;
use App\Models\Domain;
use App\Models\DomainFinancialSnapshot;
use App\Models\DomainOrder;
use App\Models\Payment;
use App\Notifications\NaiTalkDomainAutoRenewalSuccess;
use App\Services\Domains\DomainOrderService;
use App\Services\Domains\Registrars\CloudflareDomainSyncApplier;
use App\Services\Domains\Registrars\Data\RegistrarDomainResult;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class CloudflareDomainRenewalTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
        config(['services.cloudflare.sandbox_mode' => true]);
    }

    private function createCloudflareDomainDueForRenewal(string $email, string $domainName): Domain
    {
        $this->activateDomainPricing('.com');
        ['client' => $client] = $this->registerVerifiedDomainClient($email);
        $this->completeDomainContact($client);

        return Domain::query()->create([
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
            'registered_at' => now()->subYear(),
            'expires_at' => now()->addDays(10),
        ]);
    }

    private function runDomainRenewalPipeline(): void
    {
        app()->call([app(RenewDomainJob::class), 'handle']);
    }

    public function test_payment_paid_but_registrar_renewal_pending_does_not_finalize_or_double_charge(): void
    {
        Notification::fake();
        $domain = $this->createCloudflareDomainDueForRenewal('cf-renew-pending@example.test', 'cfrenewpending.com');
        app(WalletService::class)->credit($domain->client, 2_472_500, 'wallet_topup');

        $this->runDomainRenewalPipeline();

        $domain->refresh();
        $this->assertSame('pending', $domain->registrar_operation_status);
        // Cloudflare's renew() never touches expires_at directly — only a
        // follow-up sync does, once confirmed.
        $this->assertTrue($domain->expires_at->lessThan(now()->addMonths(11)));

        $domainOrder = DomainOrder::where('domain_id', $domain->id)->where('order_type', 'renewal')->firstOrFail();
        $this->assertSame('pending_payment', $domainOrder->status);
        $invoice = $domainOrder->invoice;
        $this->assertSame('paid', $invoice->status);

        Notification::assertNotSentTo($domain->client->user, NaiTalkDomainAutoRenewalSuccess::class);

        // Running the sweep again must not create a second invoice/payment —
        // the invoice is already paid so attempt() returns early.
        $paymentCountBefore = Payment::where('invoice_id', $invoice->id)->count();
        $this->runDomainRenewalPipeline();
        $this->assertSame($paymentCountBefore, Payment::where('invoice_id', $invoice->id)->count());
    }

    public function test_renewal_only_finalizes_once_a_follow_up_sync_confirms_the_expiry_date_increased(): void
    {
        Notification::fake();
        $domain = $this->createCloudflareDomainDueForRenewal('cf-renew-confirm@example.test', 'cfrenewconfirm.com');
        app(WalletService::class)->credit($domain->client, 2_472_500, 'wallet_topup');

        $this->runDomainRenewalPipeline();
        $domain->refresh();
        $this->assertSame('pending', $domain->registrar_operation_status);

        $previousExpiry = $domain->expires_at;
        $newExpiry = $previousExpiry->copy()->addYear();

        app(CloudflareDomainSyncApplier::class)->apply(new RegistrarDomainResult(
            providerDomainId: $domain->provider_domain_id,
            providerOrderId: null,
            domainName: $domain->domain_name,
            tld: '.com',
            providerStatus: 'active',
            autoRenewEnabled: true,
            expiresAt: $newExpiry->toDateTimeImmutable(),
        ));

        $domain->refresh();
        $this->assertSame('completed', $domain->registrar_operation_status);

        $domainOrder = DomainOrder::where('domain_id', $domain->id)->where('order_type', 'renewal')->firstOrFail();
        $this->assertSame('completed', $domainOrder->status);

        Notification::assertSentTo($domain->client->user, NaiTalkDomainAutoRenewalSuccess::class);
    }

    public function test_financial_snapshot_is_created_once_per_renewal_and_never_duplicated_on_retry(): void
    {
        $domain = $this->createCloudflareDomainDueForRenewal('cf-renew-snapshot@example.test', 'cfrenewsnapshot.com');
        app(WalletService::class)->credit($domain->client, 2_472_500, 'wallet_topup');

        $this->runDomainRenewalPipeline();

        $domainOrder = DomainOrder::where('domain_id', $domain->id)->where('order_type', 'renewal')->firstOrFail();
        $this->assertSame(1, DomainFinancialSnapshot::where('domain_order_id', $domainOrder->id)->count());

        // Calling createRenewalOrder again for the same order must never
        // duplicate the snapshot (idempotent on transaction_reference).
        app(DomainOrderService::class)->createRenewalOrder($domain->fresh());
        $this->assertSame(1, DomainFinancialSnapshot::where('domain_order_id', $domainOrder->id)->count());
    }

    public function test_existing_spaceship_renewal_path_is_unaffected_by_the_registrar_generalization(): void
    {
        Notification::fake();
        $this->activateDomainPricing('.com');
        ['client' => $client] = $this->registerVerifiedDomainClient('spaceship-still-works@example.test');
        $this->completeDomainContact($client);

        $domain = Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => 'spaceshipstillworks.com',
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
            'registration_status' => 'registered',
            'auto_renew' => true,
            'registered_at' => now()->subYear(),
            'expires_at' => now()->addDays(10),
        ]);

        app(WalletService::class)->credit($client, 2_472_500, 'wallet_topup');
        $this->runDomainRenewalPipeline();

        $domain->refresh();
        $this->assertSame('completed', $domain->registrar_operation_status);
        $this->assertTrue($domain->expires_at->greaterThan(now()->addMonths(11)));

        Notification::assertSentTo($client->user, NaiTalkDomainAutoRenewalSuccess::class, fn ($n) => $n->method === 'wallet');
    }
}
