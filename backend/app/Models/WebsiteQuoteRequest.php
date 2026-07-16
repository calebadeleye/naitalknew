<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebsiteQuoteRequest extends Model
{
    protected $fillable = [
        'reference',
        'name',
        'phone',
        'email',
        'website_type',
        'estimated_budget',
        'project_description',
        'status',
        'source',
        'landing_page',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'gclid',
        'referrer',
        'ip_address',
        'user_agent',
        'contacted_at',
        'converted_at',
    ];

    protected function casts(): array
    {
        return [
            'contacted_at' => 'datetime',
            'converted_at' => 'datetime',
        ];
    }
}
