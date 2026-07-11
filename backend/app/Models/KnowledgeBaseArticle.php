<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KnowledgeBaseArticle extends Model
{
    protected $fillable = [
        'group_id',
        'title',
        'slug',
        'summary',
        'content',
        'sort_order',
        'status',
        'last_updated_at',
        'seo_title',
        'seo_description',
    ];

    protected function casts(): array
    {
        return [
            'last_updated_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(KnowledgeBaseGroup::class, 'group_id');
    }

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }
}
