<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** A short-lived emailed code: password reset, or confirming a recovery email. */
class GreenmailCode extends Model
{
    protected $fillable = ['owner_email', 'purpose', 'target', 'code_hash', 'attempts', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime', 'attempts' => 'integer'];
    }
}
