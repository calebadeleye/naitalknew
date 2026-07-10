<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'invoice_id',
        'gateway',
        'purpose',
        'reference',
        'status',
        'amount_kobo',
        'currency',
        'paid_at',
        'reconciled_at',
        'gateway_payload',
        'receipt_path',
    ];

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'reconciled_at' => 'datetime',
            'gateway_payload' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
