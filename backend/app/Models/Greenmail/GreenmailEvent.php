<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailEvent extends Model
{
    protected $fillable = ['owner_email', 'title', 'starts_at', 'ends_at', 'all_day', 'location', 'notes'];

    protected $hidden = ['owner_email'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'all_day' => 'boolean'];
    }
}
