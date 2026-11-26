<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GreenmailCampaignRecipient extends Model
{
    protected $fillable = ['campaign_id', 'email', 'name', 'status', 'error', 'sent_at', 'opened_at', 'open_count', 'clicked_at', 'click_count', 'unsubscribed_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'opened_at' => 'datetime', 'clicked_at' => 'datetime', 'unsubscribed_at' => 'datetime'];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(GreenmailCampaign::class, 'campaign_id');
    }

    /** For the open pixel and tracked links: unguessable without the app key. */
    public function trackingToken(): string
    {
        return $this->id.'.'.substr(hash_hmac('sha256', 'gm-track|'.$this->id.'|'.$this->email, (string) config('app.key')), 0, 24);
    }

    /** For the unsubscribe link: unguessable without the app key. */
    public function unsubscribeToken(): string
    {
        return $this->id.'.'.substr(hash_hmac('sha256', 'gm-unsub|'.$this->id.'|'.$this->email, (string) config('app.key')), 0, 32);
    }
}
