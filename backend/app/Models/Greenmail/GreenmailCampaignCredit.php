<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** A bought (or given) batch of campaign emails for one domain, valid until expires_at. */
class GreenmailCampaignCredit extends Model
{
    protected $fillable = ['domain', 'client_id', 'amount', 'remaining', 'source', 'payment_id', 'note', 'expires_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }
}
