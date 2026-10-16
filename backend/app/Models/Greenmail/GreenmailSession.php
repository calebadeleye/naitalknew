<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class GreenmailSession extends Model
{
    protected $fillable = ['token_hash', 'email', 'password_encrypted', 'ip_address', 'user_agent', 'last_used_at', 'expires_at'];

    protected $hidden = ['token_hash', 'password_encrypted'];

    protected function casts(): array
    {
        return ['last_used_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    public function password(): string
    {
        return Crypt::decryptString($this->password_encrypted);
    }
}
