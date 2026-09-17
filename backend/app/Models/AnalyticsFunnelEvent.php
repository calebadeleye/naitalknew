<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AnalyticsFunnelEvent extends Model
{
    protected $fillable = [
        'visitor_id',
        'funnel',
        'event_name',
        'properties',
        'value_kobo',
    ];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
        ];
    }
}
