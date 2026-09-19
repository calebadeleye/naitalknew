<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AnalyticsVisit extends Model
{
    protected $fillable = [
        'visitor_id',
        'entry_path',
        'referrer',
        'user_agent',
        'device_type',
        'engagement_tracked',
        'engaged_at',
        'suspected_bot_reason',
        'network',
        'country',
        'country_code',
        'city',
        'ip_hash',
        'started_at',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'engaged_at' => 'datetime',
            'engagement_tracked' => 'boolean',
        ];
    }

    public function pageViews(): HasMany
    {
        return $this->hasMany(AnalyticsPageView::class);
    }

    /**
     * The visits the dashboard reports by default: not flagged as a
     * suspected bot, and — for visits whose browser is able to report
     * interaction (engagement_tracked) — actually engaged with the page.
     * Visits recorded before engagement tracking existed can't be held to
     * that bar, so they count unless flagged.
     */
    public function scopeCounted(Builder $query): Builder
    {
        return $query
            ->whereNull('suspected_bot_reason')
            ->where(fn (Builder $inner) => $inner
                ->where('engagement_tracked', false)
                ->orWhereNotNull('engaged_at'));
    }
}
