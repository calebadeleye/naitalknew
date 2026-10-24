<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/** One phone with the Green Mail app that wants a notification when mail arrives (Expo push). */
class GreenmailExpoPushToken extends Model
{
    protected $fillable = ['owner_email', 'session_id', 'token', 'platform', 'password_encrypted', 'last_uid', 'last_notified_at', 'failures'];

    protected $hidden = ['token', 'password_encrypted'];

    protected function casts(): array
    {
        return ['last_uid' => 'integer', 'last_notified_at' => 'datetime', 'failures' => 'integer'];
    }

    public function password(): string
    {
        return Crypt::decryptString($this->password_encrypted);
    }
}
