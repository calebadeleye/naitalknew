<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DomainOrder extends Model
{
    protected $fillable = [
        'client_id',
        'domain_id',
        'order_id',
        'hosting_service_id',
        'domain_name',
        'order_type',
        'provider',
        'provider_reference',
        'invoice_id',
        'status',
        'price_kobo',
        'vat_amount_kobo',
        'total_amount_kobo',
        'error_message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function domain(): BelongsTo
    {
        return $this->belongsTo(Domain::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function hostingService(): BelongsTo
    {
        return $this->belongsTo(HostingService::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
