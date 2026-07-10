<?php

namespace Tests\Feature;

use App\Jobs\RenewDomainJob;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\Invoice;
use App\Notifications\NaiTalkDomainAutoRenewalSuccess;
use App\Notifications\NaiTalkDomainRenewalReminder;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class DomainAutoRenewalTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    private function createRegisteredDomainDueForRenewal(string $email, string $domainName): Domain
    {
        $this->activateDomainPricing('.com');
        ['client' => $client] = $this->registerVerifiedDomainClient($email);
        $this->completeDomainContact($client);

        return Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => $domainName,
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
            'registration_status' => 'registered',
            'auto_renew' => true,
            'registered_at' => now()->subYear(),
            'expires_at' => now()->addDays(10),
        ]);
    }

    private function runDomainRenewalPipeline(): void
    {
        app()->call([app(RenewDomainJob::class), 'handle']);
    }

    public function test_domain_auto_renewal_pays_from_wallet_first_and_renews_via_spaceship(): void
    {
        Notification::fake();
        $domain = $this->createRegisteredDomainDueForRenewal('domain-renew-wallet@example.test', 'renewfromwallet.com');

        // ₦23,000 renewal subtotal, 7.5% VAT => ₦24,725.
        app(WalletService::class)->credit($domain->client, 2_472_500, 'wallet_topup');

        $this->runDomainRenewalPipeline();

        $domainOrder = DomainOrder::where('domain_id', $domain->id)->where('order_type', 'renewal')->firstOrFail();
        $invoice = Invoice::find($domainOrder->invoice_id);
        $this->assertSame('paid', $invoice->status);

        $domain->refresh();
        $this->assertTrue($domain->expires_at->greaterThan(now()->addMonths(11)));

        Notification::assertSentTo($domain->client->user, NaiTalkDomainAutoRenewalSuccess::class, fn ($n) => $n->method === 'wallet');
    }

    public function test_domain_auto_renewal_sends_a_reminder_when_there_is_no_wallet_balance_or_saved_card(): void
    {
        Notification::fake();
        $domain = $this->createRegisteredDomainDueForRenewal('domain-renew-none@example.test', 'nofundstorenew.com');

        $this->runDomainRenewalPipeline();

        $domain->refresh();
        $this->assertSame('registered', $domain->registration_status);
        $this->assertFalse($domain->expires_at->greaterThan(now()->addMonths(11)));

        Notification::assertSentTo($domain->client->user, NaiTalkDomainRenewalReminder::class);
    }
}
