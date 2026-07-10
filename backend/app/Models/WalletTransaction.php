<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

/**
 * Wallet transactions are an append-only ledger: once written, a row must
 * never be mutated or removed, so the audit trail behind every wallet
 * balance stays trustworthy. Use WalletService to create rows.
 */
class WalletTransaction extends Model
{
    protected $fillable = [
        'wallet_id',
        'client_id',
        'invoice_id',
        'order_id',
        'type',
        'direction',
        'amount_kobo',
        'balance_before_kobo',
        'balance_after_kobo',
        'payment_reference',
        'description',
        'metadata',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new RuntimeException('Wallet transactions are immutable and cannot be updated.');
        });

        static::deleting(function (): never {
            throw new RuntimeException('Wallet transactions are immutable and cannot be deleted.');
        });
    }

    public function wallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
