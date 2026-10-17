<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/** One device that wants a notification when mail arrives (Web Push). */
class GreenmailPushSubscription extends Model
{
    protected $fillable = ['owner_email', 'session_id', 'endpoint_hash', 'endpoint', 'public_key', 'auth_token', 'password_encrypted', 'domain', 'last_uid', 'last_notified_at', 'failures'];

    protected $hidden = ['endpoint', 'public_key', 'auth_token', 'password_encrypted'];

    protected function casts(): array
    {
        return ['last_uid' => 'integer', 'last_notified_at' => 'datetime', 'failures' => 'integer'];
    }

    public function password(): string
    {
        return Crypt::decryptString($this->password_encrypted);
    }
}
