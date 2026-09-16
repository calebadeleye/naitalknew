<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NaiGrowthSocialAccount extends Model
{
    protected $table = 'naigrowth_social_accounts';

    protected $fillable = [
        'platform',
        'display_name',
        'external_account_id',
        'access_token_encrypted',
        'status',
        'connected_by_user_id',
        'connected_at',
        'last_synced_at',
    ];

    // Never serialize the token back into any API response -- write-only
    // from the frontend's perspective, same treatment as
    // DomainTransfer::epp_code_encrypted.
    protected $hidden = ['access_token_encrypted'];

    protected function casts(): array
    {
        return [
            'access_token_encrypted' => 'encrypted',
            'connected_at' => 'datetime',
            'last_synced_at' => 'datetime',
        ];
    }

    public function connectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by_user_id');
    }
}
