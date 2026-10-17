<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

class GreenmailSetting extends Model
{
    protected $fillable = ['owner_email', 'display_name', 'signature_html', 'recovery_email', 'recovery_email_verified_at'];

    protected function casts(): array
    {
        return ['recovery_email_verified_at' => 'datetime'];
    }

    protected $hidden = ['owner_email'];
}
