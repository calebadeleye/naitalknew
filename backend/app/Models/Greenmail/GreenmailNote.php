<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailNote extends Model
{
    protected $fillable = ['owner_email', 'title', 'body', 'color', 'pinned'];

    protected $hidden = ['owner_email'];

    protected function casts(): array
    {
        return ['pinned' => 'boolean'];
    }
}
