<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailContact extends Model
{
    protected $fillable = ['owner_email', 'name', 'email', 'phone', 'company', 'notes'];

    protected $hidden = ['owner_email'];
}
