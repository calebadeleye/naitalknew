<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailTask extends Model
{
    protected $fillable = ['owner_email', 'title', 'due_date', 'done', 'completed_at', 'notes'];

    protected $hidden = ['owner_email'];

    protected function casts(): array
    {
        return ['due_date' => 'date:Y-m-d', 'done' => 'boolean', 'completed_at' => 'datetime'];
    }
}
