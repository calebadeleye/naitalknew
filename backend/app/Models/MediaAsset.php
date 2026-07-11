<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaAsset extends Model
{
    protected $fillable = [
        'source',
        'source_provider',
        'source_id',
        'cache_key',
        'url',
        'alt_text',
        'photographer',
        'provider_url',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }
}
