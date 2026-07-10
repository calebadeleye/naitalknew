<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DomainTransfer extends Model
{
    protected $fillable = [
        'client_id',
        'domain_id',
        'domain_name',
        'provider',
        'epp_code_encrypted',
        'transfer_status',
        'provider_transfer_id',
        'invoice_id',
        'initiated_at',
        'completed_at',
        'failed_at',
        'failure_reason',
        'metadata',
    ];

    // Never serialize the (decrypted-on-access) EPP/auth code back into any
    // API response — it must only ever be used transiently in memory inside
    // SpaceshipDomainTransferService for the outbound Spaceship call.
    protected $hidden = ['epp_code_encrypted'];

    protected function casts(): array
    {
        return [
            // Ciphertext at rest; only ever decrypted transiently inside
            // SpaceshipDomainTransferService for the outbound API call.
            'epp_code_encrypted' => 'encrypted',
            'initiated_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
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

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
