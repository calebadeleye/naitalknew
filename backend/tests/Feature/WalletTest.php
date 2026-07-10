<?php

namespace Tests\Feature;

use App\Exceptions\InsufficientWalletBalanceException;
use App\Models\Client;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class WalletTest extends TestCase
{
    use RefreshDatabase;

    private function makeClient(): Client
    {
        $user = User::factory()->create();

        return Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);
    }

    public function test_credit_and_debit_update_wallet_balance_correctly(): void
    {
        $service = app(WalletService::class);
        $client = $this->makeClient();

        $credit = $service->credit($client, 5_000_00, 'wallet_topup', ['description' => 'top up']);
        $this->assertSame(0, $credit->balance_before_kobo);
        $this->assertSame(500_000, $credit->balance_after_kobo);
        $this->assertSame(500_000, $service->walletFor($client)->fresh()->balance_kobo);

        $debit = $service->debit($client, 200_000, 'wallet_payment', ['description' => 'spend']);
        $this->assertSame(500_000, $debit->balance_before_kobo);
        $this->assertSame(300_000, $debit->balance_after_kobo);
        $this->assertSame(300_000, $service->walletFor($client)->fresh()->balance_kobo);
    }

    public function test_debit_rejects_when_balance_is_insufficient(): void
    {
        $service = app(WalletService::class);
        $client = $this->makeClient();
        $service->credit($client, 100_000, 'wallet_topup');

        $this->expectException(InsufficientWalletBalanceException::class);
        $service->debit($client, 200_000, 'wallet_payment');
    }

    public function test_wallet_transactions_are_immutable(): void
    {
        $service = app(WalletService::class);
        $client = $this->makeClient();
        $transaction = $service->credit($client, 100_000, 'wallet_topup');

        $this->expectException(RuntimeException::class);
        $transaction->update(['amount_kobo' => 1]);
    }

    public function test_wallet_transactions_cannot_be_deleted(): void
    {
        $service = app(WalletService::class);
        $client = $this->makeClient();
        $transaction = $service->credit($client, 100_000, 'wallet_topup');

        $this->expectException(RuntimeException::class);
        $transaction->delete();
    }

    public function test_credit_with_the_same_payment_reference_does_not_double_credit(): void
    {
        $service = app(WalletService::class);
        $client = $this->makeClient();

        $service->credit($client, 100_000, 'overpayment_credit', ['payment_reference' => 'REF-1']);
        $service->credit($client, 100_000, 'overpayment_credit', ['payment_reference' => 'REF-1']);

        $this->assertSame(100_000, $service->walletFor($client)->fresh()->balance_kobo);
        $this->assertSame(1, WalletTransaction::where('payment_reference', 'REF-1')->count());
    }
}
