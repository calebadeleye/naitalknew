<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** One open or click of a campaign email (for the report's timeline). */
class GreenmailCampaignEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['campaign_id', 'recipient_id', 'type', 'link_id', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
