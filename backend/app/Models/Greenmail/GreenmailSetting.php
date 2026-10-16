<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailSetting extends Model
{
    protected $fillable = ['owner_email', 'display_name', 'signature_html'];

    protected $hidden = ['owner_email'];
}
