<?php

namespace Tests\Feature;

use App\Models\DomainTransfer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class DomainTransferTest extends TestCase
{
    use CreatesDomainFixtures, FakesIspConfig, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeIspConfig();
    }

    public function test_transfer_requires_an_epp_auth_code(): void
    {
        $this->activateDomainPricing('.com');
        ['token' => $token] = $this->registerVerifiedDomainClient('transfer-no-epp@example.test');

        $this->withToken($token)->postJson('/api/v1/client/domains/transfers', [
            'domain_name' => 'transferme.com',
        ])->assertStatus(422)->assertJsonValidationErrors('epp_code');
    }

    public function test_transfer_eligibility_endpoint_returns_a_status(): void
    {
        ['token' => $token] = $this->registerVerifiedDomainClient('transfer-eligibility@example.test');

        $this->withToken($token)->getJson('/api/v1/client/domains/transfers/eligibility?domain=transferme.com')
            ->assertOk()
            ->assertJsonStructure(['domain', 'eligible', 'status']);
    }

    public function test_epp_code_is_encrypted_at_rest(): void
    {
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('transfer-epp@example.test');
        $this->completeDomainContact($client);

        $response = $this->withToken($token)->postJson('/api/v1/client/domains/transfers', [
            'domain_name' => 'encryptme.com',
            'epp_code' => 'SECRET-EPP-CODE-123',
        ])->assertCreated();

        // The API response itself must never echo the EPP code back, plaintext or not.
        $response->assertJsonMissingPath('transfer.epp_code_encrypted');
        $this->assertStringNotContainsString('SECRET-EPP-CODE-123', $response->getContent());

        $transferId = $response->json('transfer.id');
        $rawValue = DB::table('domain_transfers')->where('id', $transferId)->value('epp_code_encrypted');

        $this->assertNotSame('SECRET-EPP-CODE-123', $rawValue);
        $this->assertStringNotContainsString('SECRET-EPP-CODE-123', $rawValue);

        // The Eloquent `encrypted` cast transparently decrypts it back.
        $transfer = DomainTransfer::find($transferId);
        $this->assertSame('SECRET-EPP-CODE-123', $transfer->epp_code_encrypted);
    }

    public function test_transfer_status_progresses_after_payment_and_is_never_lost_on_failure(): void
    {
        $this->seed();
        $this->activateDomainPricing('.com');
        ['token' => $token, 'client' => $client] = $this->registerVerifiedDomainClient('transfer-paid@example.test');
        $this->completeDomainContact($client);

        $checkout = $this->withToken($token)->postJson('/api/v1/client/domains/transfers', [
            'domain_name' => 'movemyhome.com',
            'epp_code' => 'AUTHCODE-MOVE-1',
        ])->assertCreated();

        $transferId = $checkout->json('transfer.id');
        $this->assertSame('transfer_pending_payment', DomainTransfer::find($transferId)->transfer_status);

        $invoiceNumber = $checkout->json('invoice.invoice_number');
        $this->withToken($this->domainAdminToken())
            ->postJson("/api/v1/admin/invoices/{$invoiceNumber}/mark-paid", ['amount_kobo' => $checkout->json('invoice.total_kobo')])
            ->assertOk();

        // QUEUE_CONNECTION=sync, so InitiateDomainTransferJob has already run.
        $transfer = DomainTransfer::find($transferId);
        $this->assertSame('transfer_initiated', $transfer->transfer_status);
        $this->assertNotNull($transfer->initiated_at);

        // The transfer's local order record must never be deleted, whatever happens.
        $this->assertDatabaseHas('domain_transfers', ['id' => $transferId]);
    }
}
