<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    protected $fillable = ['name', 'email', 'phone', 'service', 'details', 'page', 'ip_address', 'user_agent', 'emailed_at'];

    protected $casts = ['emailed_at' => 'datetime'];
}
