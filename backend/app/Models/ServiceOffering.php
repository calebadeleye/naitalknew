<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceOffering extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'category',
        'short_description',
        'benefits',
        'price_kobo',
        'billing_type',
        'is_quote_only',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'benefits' => 'array',
            'is_quote_only' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
