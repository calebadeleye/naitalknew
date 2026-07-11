<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KnowledgeBaseGroup extends Model
{
    protected $fillable = ['name', 'slug', 'icon', 'sort_order'];

    public function articles(): HasMany
    {
        return $this->hasMany(KnowledgeBaseArticle::class, 'group_id');
    }
}
