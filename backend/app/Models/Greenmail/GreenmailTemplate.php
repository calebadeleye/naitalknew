<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailTemplate extends Model
{
    protected $fillable = ['owner_email', 'name', 'subject', 'body_html'];

    protected $hidden = ['owner_email'];
}
