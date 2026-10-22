<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** "Remind me if nobody replies" for an email the mailbox sent. */
class GreenmailFollowUp extends Model
{
    protected $table = 'greenmail_followups';

    protected $fillable = ['owner_email', 'password_encrypted', 'message_id', 'subject', 'recipients', 'sent_folder', 'remind_at', 'status', 'checked_at', 'error'];

    protected $hidden = ['owner_email', 'password_encrypted'];

    protected function casts(): array
    {
        return ['recipients' => 'array', 'remind_at' => 'datetime', 'checked_at' => 'datetime'];
    }
}
