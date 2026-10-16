<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One email sent separately to each person on a list, a few a minute. */
class GreenmailCampaign extends Model
{
    protected $fillable = ['owner_email', 'password_encrypted', 'name', 'subject', 'body_html', 'status', 'send_at', 'total', 'sent_count', 'failed_count', 'skipped_count', 'started_at', 'finished_at', 'last_error'];

    protected $hidden = ['owner_email', 'password_encrypted'];

    protected function casts(): array
    {
        return ['send_at' => 'datetime', 'started_at' => 'datetime', 'finished_at' => 'datetime'];
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(GreenmailCampaignRecipient::class, 'campaign_id');
    }
}
