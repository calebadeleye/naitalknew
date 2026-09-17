<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AnalyticsVisit extends Model
{
    protected $fillable = [
        'visitor_id',
        'entry_path',
        'referrer',
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
        ];
    }

    public function pageViews(): HasMany
    {
        return $this->hasMany(AnalyticsPageView::class);
    }
}
