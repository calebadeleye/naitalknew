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
}
