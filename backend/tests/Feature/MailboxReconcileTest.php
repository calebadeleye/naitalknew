<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\EmailDomainRecord;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use App\Services\Ispconfig\FakeIspConfigClient;
use App\Services\Ispconfig\MailboxDiscoveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

/** Mailboxes belong to the service of their own domain, whoever owns them in ISPConfig. */
class MailboxReconcileTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private FakeIspConfigClient $isp;

    private HostingService $house;

    private HostingService $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->isp = $this->fakeIspConfig();
        $this->house = $this->service();
        $this->customer = $this->service();
    }

    private function service(): HostingService
    {
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    private function mailbox(string $email, int $ispClient = 4): int
    {
        return $this->isp->mailUserAdd($this->isp->login(), $ispClient, ['email' => $email, 'name' => 'Box', 'quota' => 0, 'postfix' => 'y']);
    }

    private function record(HostingService $service, string $email, int $remoteId): MailboxRecord
    {
        return MailboxRecord::query()->create(['hosting_service_id' => $service->id, 'ispconfig_mailbox_id' => (string) $remoteId, 'email_address' => $email, 'quota_mb' => 0, 'status' => 'active']);
    }

    public function test_a_customers_mailbox_parked_on_another_service_moves_to_its_own(): void
    {
        $email = 'info@'.strtolower($this->customer->primary_domain);
        $record = $this->record($this->house, $email, $this->mailbox($email));
        EmailDomainRecord::query()->create(['hosting_service_id' => $this->house->id, 'domain' => strtolower($this->customer->primary_domain), 'status' => 'active']);

        $this->artisan('mailboxes:reconcile')->assertSuccessful();

        $this->assertSame($this->customer->id, $record->fresh()->hosting_service_id);
        $this->assertSame(0, $this->house->mailboxRecords()->count());
        $this->assertSame(0, EmailDomainRecord::query()->where('hosting_service_id', $this->house->id)->count());
        $this->assertSame(1, EmailDomainRecord::query()->where('hosting_service_id', $this->customer->id)->count());
    }

    public function test_a_mailbox_only_in_ispconfig_is_added_even_when_another_account_owns_it(): void
    {
        $email = 'sales@'.strtolower($this->customer->primary_domain);
        $this->mailbox($email, 4242);

        $this->artisan('mailboxes:reconcile')->assertSuccessful();
        $this->artisan('mailboxes:reconcile')->assertSuccessful();

        $this->assertSame([$email], $this->customer->mailboxRecords()->pluck('email_address')->all());
    }

    public function test_a_domain_with_no_service_is_left_alone(): void
    {
        $record = $this->record($this->house, 'a@unowned.test', $this->mailbox('a@unowned.test'));
        $this->mailbox('b@unowned.test');

        $this->artisan('mailboxes:reconcile')->assertSuccessful();

        $this->assertSame($this->house->id, $record->fresh()->hosting_service_id);
        $this->assertSame(1, MailboxRecord::query()->where('email_address', 'like', '%@unowned.test')->count());
    }

    public function test_dry_run_changes_nothing(): void
    {
        $email = 'info@'.strtolower($this->customer->primary_domain);
        $record = $this->record($this->house, $email, $this->mailbox($email));
        $this->mailbox('new@'.strtolower($this->customer->primary_domain));

        $this->artisan('mailboxes:reconcile', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame($this->house->id, $record->fresh()->hosting_service_id);
        $this->assertSame(1, MailboxRecord::query()->count());
    }

    public function test_discovery_finds_a_mailbox_owned_by_another_ispconfig_account(): void
    {
        $email = 'help@'.strtolower($this->customer->primary_domain);
        $this->mailbox($email, 4242);

        $result = app(MailboxDiscoveryService::class)->discover($this->customer);

        $this->assertSame(1, $result['imported']);
        $this->assertSame([$email], $this->customer->mailboxRecords()->pluck('email_address')->all());
    }
}
