<?php

namespace App\Services\Wallet;

use App\Exceptions\InsufficientWalletBalanceException;
use App\Models\Client;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;

/**
 * The only place wallet balances are ever mutated. Every credit/debit is
 * wrapped in a DB transaction with a row lock on the wallet, and always
 * writes exactly one immutable WalletTransaction — this is what keeps the
 * ledger auditable and prevents concurrent double-spending.
 */
class WalletService
{
    public function walletFor(Client $client): Wallet
    {
        return Wallet::query()->firstOrCreate(
            ['client_id' => $client->id],
            ['balance_kobo' => 0, 'currency' => 'NGN', 'status' => 'active']
        );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function credit(Client $client, int $amountKobo, string $type, array $attributes = []): WalletTransaction
    {
        if ($amountKobo <= 0) {
            throw new \InvalidArgumentException('Wallet credit amount must be positive.');
        }

        return DB::transaction(function () use ($client, $amountKobo, $type, $attributes) {
            $wallet = $this->lockedWalletFor($client);

            $paymentReference = $attributes['payment_reference'] ?? null;

            if ($paymentReference) {
                $existing = WalletTransaction::query()
                    ->where('wallet_id', $wallet->id)
                    ->where('payment_reference', $paymentReference)
                    ->where('type', $type)
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            $balanceBefore = $wallet->balance_kobo;
            $balanceAfter = $balanceBefore + $amountKobo;

            $wallet->forceFill(['balance_kobo' => $balanceAfter])->save();

            return $this->recordTransaction($wallet, $client, $type, 'credit', $amountKobo, $balanceBefore, $balanceAfter, $attributes);
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     *
     * @throws InsufficientWalletBalanceException
     */
    public function debit(Client $client, int $amountKobo, string $type, array $attributes = []): WalletTransaction
    {
        if ($amountKobo <= 0) {
            throw new \InvalidArgumentException('Wallet debit amount must be positive.');
        }

        return DB::transaction(function () use ($client, $amountKobo, $type, $attributes) {
            $wallet = $this->lockedWalletFor($client);

            if ($wallet->balance_kobo < $amountKobo) {
                throw new InsufficientWalletBalanceException('Wallet balance is insufficient for this debit.');
            }

            $balanceBefore = $wallet->balance_kobo;
            $balanceAfter = $balanceBefore - $amountKobo;

            $wallet->forceFill(['balance_kobo' => $balanceAfter])->save();

            return $this->recordTransaction($wallet, $client, $type, 'debit', $amountKobo, $balanceBefore, $balanceAfter, $attributes);
        });
    }

    private function lockedWalletFor(Client $client): Wallet
    {
        $wallet = $this->walletFor($client);

        return Wallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function recordTransaction(Wallet $wallet, Client $client, string $type, string $direction, int $amountKobo, int $balanceBefore, int $balanceAfter, array $attributes): WalletTransaction
    {
        /** @var User|null $actor */
        $actor = $attributes['actor'] ?? null;

        return WalletTransaction::query()->create([
            'wallet_id' => $wallet->id,
            'client_id' => $client->id,
            'invoice_id' => $attributes['invoice_id'] ?? null,
            'order_id' => $attributes['order_id'] ?? null,
            'type' => $type,
            'direction' => $direction,
            'amount_kobo' => $amountKobo,
            'balance_before_kobo' => $balanceBefore,
            'balance_after_kobo' => $balanceAfter,
            'payment_reference' => $attributes['payment_reference'] ?? null,
            'description' => $attributes['description'] ?? null,
            'metadata' => $attributes['metadata'] ?? null,
            'created_by' => $actor?->id,
        ]);
    }
}
