<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'order_id',
        'hosting_service_id',
        'invoice_number',
        'status',
        'reconciliation_status',
        'subtotal_kobo',
        'discount_kobo',
        'tax_kobo',
        'vat_rate',
        'total_kobo',
        'amount_paid_kobo',
        'wallet_amount_applied_kobo',
        'overpayment_amount_kobo',
        'underpayment_amount_kobo',
        'outstanding_amount_kobo',
        'issued_at',
        'due_at',
        'paid_at',
        'line_items',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'date',
            'due_at' => 'date',
            'paid_at' => 'date',
            'line_items' => 'array',
            'vat_rate' => 'float',
        ];
    }

    /**
     * What is still owed — the full total for an untouched invoice, the
     * remaining balance after a partial payment. Same rule the wallet and
     * saved-card flows already use; gateways and bank transfer must charge
     * this, not total_kobo, or a client who part-paid gets asked for the
     * whole invoice again.
     */
    public function payableKobo(): int
    {
        return (int) ($this->outstanding_amount_kobo ?: max($this->total_kobo - $this->amount_paid_kobo, 0));
    }

    /**
     * The invoice's bank-transfer payment that is still waiting to be
     * reconciled — or a fresh one when every earlier transfer has already
     * been applied. Reusing a reconciled row is what made a second part
     * payment vanish: reconcile() treats an already-reconciled payment as a
     * duplicate webhook and silently does nothing.
     */
    public function openBankTransferPayment(string $status, int $amountKobo): Payment
    {
        $payment = $this->payments()->where('gateway', 'bank_transfer')->whereNull('reconciled_at')->latest('id')->first();

        if (! $payment) {
            $sequence = $this->payments()->where('gateway', 'bank_transfer')->count();

            $payment = new Payment;
            $payment->forceFill([
                'client_id' => $this->client_id,
                'invoice_id' => $this->id,
                'gateway' => 'bank_transfer',
                'reference' => 'BANK-'.$this->invoice_number.($sequence > 0 ? '-'.($sequence + 1) : ''),
                'currency' => 'NGN',
            ]);
        }

        $payment->forceFill(['status' => $status, 'amount_kobo' => $amountKobo])->save();

        return $payment;
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function walletTransactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class);
    }

    public function domainOrders(): HasMany
    {
        return $this->hasMany(DomainOrder::class);
    }

    public function domainTransfers(): HasMany
    {
        return $this->hasMany(DomainTransfer::class);
    }
}
