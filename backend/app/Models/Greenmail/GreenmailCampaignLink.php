<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** A link in a campaign email; clicks go through Green Mail so they can be counted. */
class GreenmailCampaignLink extends Model
{
    protected $fillable = ['campaign_id', 'url_hash', 'url', 'clicks'];
}
