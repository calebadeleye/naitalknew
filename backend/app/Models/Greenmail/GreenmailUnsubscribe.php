<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailUnsubscribe extends Model
{
    protected $fillable = ['owner_email', 'email'];
}
