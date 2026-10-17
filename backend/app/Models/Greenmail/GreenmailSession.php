<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class GreenmailSession extends Model
{
    protected $fillable = ['token_hash', 'email', 'password_encrypted', 'previous_password_encrypted', 'password_changed_at', 'ip_address', 'user_agent', 'last_used_at', 'expires_at'];

    protected $hidden = ['token_hash', 'password_encrypted', 'previous_password_encrypted'];

    protected function casts(): array
    {
        return ['last_used_at' => 'datetime', 'expires_at' => 'datetime', 'password_changed_at' => 'datetime'];
    }

    public function password(): string
    {
        return Crypt::decryptString($this->password_encrypted);
    }

    /** The password from before a change made in the last few minutes (the mail server can take a moment to switch). */
    public function recentPreviousPassword(): ?string
    {
        if (! $this->previous_password_encrypted || ! $this->password_changed_at || $this->password_changed_at->lt(now()->subMinutes(5))) {
            return null;
        }

        return Crypt::decryptString($this->previous_password_encrypted);
    }
}
