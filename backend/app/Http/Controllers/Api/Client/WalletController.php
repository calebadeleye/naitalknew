<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Services\Billing\Money;
use App\Services\Wallet\WalletService;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function show(Request $request, WalletService $walletService)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $wallet = $walletService->walletFor($client);

        return response()->json([
            'balance_kobo' => $wallet->balance_kobo,
            'balance' => Money::naira($wallet->balance_kobo),
            'currency' => $wallet->currency,
            'status' => $wallet->status,
        ]);
    }

    public function transactions(Request $request, WalletService $walletService)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $wallet = $walletService->walletFor($client);

        $transactions = $wallet->transactions()
            ->with(['invoice', 'order'])
            ->paginate(20)
            ->through(fn ($transaction) => [
                'id' => $transaction->id,
                'type' => $transaction->type,
                'direction' => $transaction->direction,
                'amount' => Money::naira($transaction->amount_kobo),
                'amount_kobo' => $transaction->amount_kobo,
                'balance_before' => Money::naira($transaction->balance_before_kobo),
                'balance_after' => Money::naira($transaction->balance_after_kobo),
                'invoice_number' => $transaction->invoice?->invoice_number,
                'order_number' => $transaction->order?->order_number,
                'payment_reference' => $transaction->payment_reference,
                'description' => $transaction->description,
                // Wallet transactions are only ever written once a movement
                // is finalized (no pending/failed rows are ever recorded),
                // so every ledger entry is, by construction, "completed".
                'status' => 'completed',
                'created_at' => $transaction->created_at?->toIso8601String(),
            ]);

        return response()->json($transactions);
    }
}
