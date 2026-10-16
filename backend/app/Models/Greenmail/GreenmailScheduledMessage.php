<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** An email composed now and sent later by the scheduler (greenmail:dispatch). */
class GreenmailScheduledMessage extends Model
{
    protected $fillable = ['owner_email', 'password_encrypted', 'subject', 'recipients', 'raw_path', 'send_at', 'status', 'error', 'sent_at'];

    protected $hidden = ['owner_email', 'password_encrypted', 'raw_path'];

    protected function casts(): array
    {
        return ['recipients' => 'array', 'send_at' => 'datetime', 'sent_at' => 'datetime'];
    }
}
