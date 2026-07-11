<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Faq extends Model
{
    protected $fillable = ['group', 'question', 'answer', 'sort_order', 'status'];

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }
}
